using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using WorkflowOrchestrationService.Controllers;
using WorkflowOrchestrationService.Data;
using WorkflowOrchestrationService.Models;

namespace WorkflowOrchestrationService.Tests;

[TestFixture]
public class ApprovalChainTests
{
    // ── Seed helpers ─────────────────────────────────────────────────────────────

    private static WorkflowDbContext BuildDb(string dbName)
    {
        var opts = new DbContextOptionsBuilder<WorkflowDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        return new WorkflowDbContext(opts);  // design-time ctor → TenantSchema = "public"
    }

    private static async Task SeedLevelsAsync(WorkflowDbContext db)
    {
        db.ApprovalLevels.AddRange(new[]
        {
            new ApprovalLevel { Id = 1, WorkflowType = "LOAN_ORIGINATION", AmountMin = 0m,       AmountMax = decimal.MaxValue, Sequence = 1, Label = "Branch Manager",   RequiredRole = "CHECKER" },
            new ApprovalLevel { Id = 2, WorkflowType = "LOAN_ORIGINATION", AmountMin = 500000m,  AmountMax = decimal.MaxValue, Sequence = 2, Label = "Credit Committee", RequiredRole = "MANAGER" },
            new ApprovalLevel { Id = 3, WorkflowType = "LOAN_ORIGINATION", AmountMin = 2500000m, AmountMax = decimal.MaxValue, Sequence = 3, Label = "Board Approval",   RequiredRole = "BOARD"   },
        });
        await db.SaveChangesAsync();
    }

    private static ApprovalController BuildController(WorkflowDbContext db)
        => new ApprovalController(db, NullLogger<ApprovalController>.Instance);

    // ── FR-WF-001: Amount-band routing ───────────────────────────────────────────

    [Test]
    public async Task AmountBand_Under5L_Gets1Level()
    {
        await using var db = BuildDb($"ab-1-{Guid.NewGuid()}");
        await SeedLevelsAsync(db);
        var ctrl = BuildController(db);

        var result = await ctrl.InitChain(new InitChainRequest("APP-001", "LOAN", "LOAN_ORIGINATION", 400_000m));

        var ok    = (OkObjectResult)result.Result!;
        var steps = ((IEnumerable<ApprovalChainStep>)ok.Value!).ToList();

        Assert.That(steps, Has.Count.EqualTo(1));
        Assert.That(steps[0].Label,    Is.EqualTo("Branch Manager"));
        Assert.That(steps[0].Sequence, Is.EqualTo(1));
        Assert.That(steps[0].Status,   Is.EqualTo("PENDING"));
    }

    [Test]
    public async Task AmountBand_5Lto25L_Gets2Levels()
    {
        await using var db = BuildDb($"ab-2-{Guid.NewGuid()}");
        await SeedLevelsAsync(db);
        var ctrl = BuildController(db);

        var result = await ctrl.InitChain(new InitChainRequest("APP-002", "LOAN", "LOAN_ORIGINATION", 1_000_000m));

        var ok    = (OkObjectResult)result.Result!;
        var steps = ((IEnumerable<ApprovalChainStep>)ok.Value!).ToList();

        Assert.That(steps, Has.Count.EqualTo(2));
        Assert.That(steps[0].Label, Is.EqualTo("Branch Manager"));
        Assert.That(steps[1].Label, Is.EqualTo("Credit Committee"));
    }

    // ── FR-WF-003: Sequential enforcement ────────────────────────────────────────

    [Test]
    public async Task Sequential_BlocksLevel2_WhenLevel1Pending()
    {
        await using var db = BuildDb($"seq-{Guid.NewGuid()}");
        var step1Id = Guid.NewGuid();
        var step2Id = Guid.NewGuid();
        db.ApprovalChainSteps.AddRange(new[]
        {
            new ApprovalChainStep { Id = step1Id, EntityId = "APP-003", EntityType = "LOAN", Sequence = 1, Label = "Branch Manager",   RequiredRole = "CHECKER", Status = "PENDING", CreatedAt = DateTime.UtcNow },
            new ApprovalChainStep { Id = step2Id, EntityId = "APP-003", EntityType = "LOAN", Sequence = 2, Label = "Credit Committee", RequiredRole = "MANAGER", Status = "PENDING", CreatedAt = DateTime.UtcNow },
        });
        await db.SaveChangesAsync();
        var ctrl = BuildController(db);

        // Try to approve Level 2 while Level 1 is still PENDING — must be blocked
        var result = await ctrl.SubmitStepAction(step2Id, new ChainStepActionRequest("APPROVE", "officer1", null));

        Assert.That(result.Result, Is.InstanceOf<BadRequestObjectResult>());
    }

    // ── FR-WF-004: Rejection terminates chain ────────────────────────────────────

    [Test]
    public async Task Rejection_MarksRemainingSteps_Skipped()
    {
        await using var db = BuildDb($"rej-{Guid.NewGuid()}");
        var step1Id = Guid.NewGuid();
        var step2Id = Guid.NewGuid();
        var step3Id = Guid.NewGuid();
        db.ApprovalChainSteps.AddRange(new[]
        {
            new ApprovalChainStep { Id = step1Id, EntityId = "APP-004", EntityType = "LOAN", Sequence = 1, Label = "Branch Manager",   RequiredRole = "CHECKER", Status = "PENDING", CreatedAt = DateTime.UtcNow },
            new ApprovalChainStep { Id = step2Id, EntityId = "APP-004", EntityType = "LOAN", Sequence = 2, Label = "Credit Committee", RequiredRole = "MANAGER", Status = "PENDING", CreatedAt = DateTime.UtcNow },
            new ApprovalChainStep { Id = step3Id, EntityId = "APP-004", EntityType = "LOAN", Sequence = 3, Label = "Board Approval",   RequiredRole = "BOARD",   Status = "PENDING", CreatedAt = DateTime.UtcNow },
        });
        await db.SaveChangesAsync();
        var ctrl = BuildController(db);

        // REJECT at Level 1
        var result = await ctrl.SubmitStepAction(step1Id, new ChainStepActionRequest("REJECT", "manager1", "Insufficient collateral"));

        Assert.That(result.Result, Is.InstanceOf<OkObjectResult>());

        var step2 = await db.ApprovalChainSteps.FindAsync(step2Id);
        var step3 = await db.ApprovalChainSteps.FindAsync(step3Id);
        Assert.That(step2!.Status, Is.EqualTo("SKIPPED"));
        Assert.That(step3!.Status, Is.EqualTo("SKIPPED"));
    }
}
