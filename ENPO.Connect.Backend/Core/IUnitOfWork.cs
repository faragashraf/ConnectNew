using Persistence.UnitOfWorks;
using Repositories;

namespace Core
{
    public interface IUnitOfWork : IDisposable
    {
        IRepliesRepository RepliesRepository { get; set; }
        IAdministrativeCertificateRepository administrativeCertificateRepository { get; set; }
        IDynamicFormRepository dynamicFormRepository { get; set; }
        IAttachMentsRepositories attachMentsRepositories { get; }
        ILandTransport landTransport { get; set; }
        Task<int> CompleteAsync();
        int Complete();
    }
}
