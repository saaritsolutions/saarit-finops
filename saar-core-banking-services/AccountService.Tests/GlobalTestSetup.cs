using NUnit.Framework;

namespace AccountService.Tests
{
    [SetUpFixture]
    public class GlobalTestSetup
    {
        [OneTimeSetUp]
        public void RunBeforeAnyTests()
        {
            // Global setup for AccountService tests if needed
        }

        [OneTimeTearDown]
        public void RunAfterAnyTests()
        {
            // Global teardown for AccountService tests if needed
        }
    }
}
