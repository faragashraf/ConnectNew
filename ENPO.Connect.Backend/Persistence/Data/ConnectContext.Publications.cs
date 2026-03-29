using Microsoft.EntityFrameworkCore;
using Models.Correspondance;

namespace Persistence.Data;

public partial class ConnectContext
{
    public virtual DbSet<PublicationRequestType> PublicationRequestTypes { get; set; }
    public virtual DbSet<PublicationDepartmentRequestType> PublicationDepartmentRequestTypes { get; set; }
    public virtual DbSet<PublicationRequest> PublicationRequests { get; set; }
    public virtual DbSet<PublicationRequestHistory> PublicationRequestHistories { get; set; }
    public virtual DbSet<PublicationAdminDepartment> PublicationAdminDepartments { get; set; }
    public virtual DbSet<PublicationSerialCounter> PublicationSerialCounters { get; set; }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PublicationRequestType>(entity =>
        {
            entity.ToTable("PUB_RequestType");
            entity.HasKey(e => e.PublicationRequestTypeId);
            entity.Property(e => e.PublicationRequestTypeId).HasColumnName("PublicationRequestTypeID");
            entity.Property(e => e.Code).HasMaxLength(50);
            entity.Property(e => e.NameAr).HasMaxLength(200);
            entity.Property(e => e.NameEn).HasMaxLength(200);
            entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
            entity.Property(e => e.ApplicationId).HasMaxLength(10).HasDefaultValue("PUBL");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.DisplayOrder).HasDefaultValue(0);
            entity.Property(e => e.CreatedAtUtc)
                .HasColumnType("datetime")
                .HasDefaultValueSql("GETUTCDATE()");
            entity.HasIndex(e => e.Code).IsUnique();
        });

        modelBuilder.Entity<PublicationDepartmentRequestType>(entity =>
        {
            entity.ToTable("PUB_DepartmentRequestType");
            entity.HasKey(e => e.PublicationDepartmentRequestTypeId);
            entity.Property(e => e.PublicationDepartmentRequestTypeId).HasColumnName("PublicationDepartmentRequestTypeID");
            entity.Property(e => e.DepartmentUnitId).HasColumnType("decimal(18,0)").HasColumnName("DepartmentUnitID");
            entity.Property(e => e.PublicationRequestTypeId).HasColumnName("PublicationRequestTypeID");
            entity.Property(e => e.CanCreate).HasDefaultValue(true);
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAtUtc)
                .HasColumnType("datetime")
                .HasDefaultValueSql("GETUTCDATE()");
            entity.HasIndex(e => new { e.DepartmentUnitId, e.PublicationRequestTypeId }).IsUnique();
            entity.HasOne(e => e.PublicationRequestType)
                .WithMany(e => e.DepartmentRequestTypes)
                .HasForeignKey(e => e.PublicationRequestTypeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PublicationRequest>(entity =>
        {
            entity.ToTable("PUB_Request");
            entity.HasKey(e => e.MessageId);
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.PublicationRequestTypeId).HasColumnName("PublicationRequestTypeID");
            entity.Property(e => e.DepartmentUnitId).HasColumnType("decimal(18,0)").HasColumnName("DepartmentUnitID");
            entity.Property(e => e.WorkflowStatus).HasMaxLength(30);
            entity.Property(e => e.CreatedBy).HasMaxLength(100);
            entity.Property(e => e.LastActionBy).HasMaxLength(100);
            entity.Property(e => e.PublicationNumber).HasMaxLength(20);
            entity.Property(e => e.FinalApprovalReplyId).HasColumnName("FinalApprovalReplyID");
            entity.Property(e => e.CreatedAtUtc).HasColumnType("datetime").HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.SubmittedAtUtc).HasColumnType("datetime");
            entity.Property(e => e.ReviewedAtUtc).HasColumnType("datetime");
            entity.Property(e => e.ReturnedAtUtc).HasColumnType("datetime");
            entity.Property(e => e.RejectedAtUtc).HasColumnType("datetime");
            entity.Property(e => e.ApprovedAtUtc).HasColumnType("datetime");
            entity.Property(e => e.LastActionAtUtc).HasColumnType("datetime");
            entity.Property(e => e.RowVersion).IsRowVersion();

            entity.HasIndex(e => e.WorkflowStatus);
            entity.HasIndex(e => new { e.DepartmentUnitId, e.WorkflowStatus });
            entity.HasIndex(e => new { e.PublicationYear, e.PublicationSerial }).IsUnique();
            entity.HasIndex(e => e.PublicationNumber).IsUnique().HasFilter("[PublicationNumber] IS NOT NULL");

            entity.HasOne(e => e.Message)
                .WithOne()
                .HasForeignKey<PublicationRequest>(e => e.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(e => e.PublicationRequestType)
                .WithMany(e => e.Requests)
                .HasForeignKey(e => e.PublicationRequestTypeId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<PublicationRequestHistory>(entity =>
        {
            entity.ToTable("PUB_RequestHistory");
            entity.HasKey(e => e.PublicationRequestHistoryId);
            entity.Property(e => e.PublicationRequestHistoryId).HasColumnName("PublicationRequestHistoryID");
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.ActionCode).HasMaxLength(40);
            entity.Property(e => e.FromStatus).HasMaxLength(30);
            entity.Property(e => e.ToStatus).HasMaxLength(30);
            entity.Property(e => e.ActionBy).HasMaxLength(100);
            entity.Property(e => e.ActionAtUtc).HasColumnType("datetime").HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.ReplyId).HasColumnName("ReplyID");

            entity.HasIndex(e => new { e.MessageId, e.ActionAtUtc });
            entity.HasIndex(e => e.ToStatus);
            entity.HasOne(e => e.PublicationRequest)
                .WithMany(e => e.Histories)
                .HasForeignKey(e => e.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PublicationAdminDepartment>(entity =>
        {
            entity.ToTable("PUB_AdminDepartment");
            entity.HasKey(e => e.PublicationAdminDepartmentId);
            entity.Property(e => e.PublicationAdminDepartmentId).HasColumnName("PublicationAdminDepartmentID");
            entity.Property(e => e.DepartmentUnitId).HasColumnType("decimal(18,0)").HasColumnName("DepartmentUnitID");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedAtUtc).HasColumnType("datetime").HasDefaultValueSql("GETUTCDATE()");
            entity.HasIndex(e => e.DepartmentUnitId).IsUnique();
        });

        modelBuilder.Entity<PublicationSerialCounter>(entity =>
        {
            entity.ToTable("PUB_SerialCounter");
            entity.HasKey(e => e.CounterYear);
            entity.Property(e => e.CounterYear).HasColumnName("CounterYear").ValueGeneratedNever();
            entity.Property(e => e.LastSerial).HasDefaultValue(0);
            entity.Property(e => e.RowVersion).IsRowVersion();
        });
    }
}
