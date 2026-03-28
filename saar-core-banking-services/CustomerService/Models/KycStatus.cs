namespace CustomerService.Models
{
    public enum KycStatus
    {
        NotStarted = 0,
        InProgress = 1,
        DocumentsSubmitted = 2,
        Verified = 3,
        Rejected = 4,
        Expired = 5,
    }

    public enum MakerCheckerStatus
    {
        Pending = 0,
        Approved = 1,
        Rejected = 2,
    }
}
