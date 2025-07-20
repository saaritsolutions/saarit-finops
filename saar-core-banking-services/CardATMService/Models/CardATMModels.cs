using Microsoft.EntityFrameworkCore;

namespace CardATMService.Models
{
    public class Card
    {
        public int Id { get; set; }
        public string CardNumber { get; set; } = string.Empty;
        public string CardType { get; set; } = string.Empty;
        public DateTime ExpiryDate { get; set; }
        public int CustomerId { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class ATMTransaction
    {
        public int Id { get; set; }
        public int CardId { get; set; }
        public Card Card { get; set; } = null!;
        public DateTime TransactionDate { get; set; }
        public decimal Amount { get; set; }
        public string TransactionType { get; set; } = string.Empty;
    }

    public class CardATMDBContext : DbContext
    {
        public CardATMDBContext(DbContextOptions<CardATMDBContext> options) : base(options) { }
        public DbSet<Card> Cards { get; set; }
        public DbSet<ATMTransaction> ATMTransactions { get; set; }
    }
}
