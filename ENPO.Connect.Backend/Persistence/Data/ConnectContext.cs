using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Models.Correspondance;
using System.Security.Claims;
namespace Persistence.Data;

public partial class ConnectContext : DbContext
{
    public ConnectContext()
    {
    }
    private readonly IHttpContextAccessor _httpContextAccessor;
    public ConnectContext(DbContextOptions<ConnectContext> options, IHttpContextAccessor httpContextAccessor)
        : base(options)
    {
        _httpContextAccessor = httpContextAccessor;
    }
    public virtual DbSet<CdCategoryMand> CdCategoryMands { get; set; }

    public virtual DbSet<Cdcategory> Cdcategories { get; set; }

    public virtual DbSet<Cdmend> Cdmends { get; set; }

    public virtual DbSet<MandGroup> MandGroups { get; set; }
    public virtual DbSet<EscProcess> EscProcesses { get; set; }

    public virtual DbSet<TkmendField> TkmendFields { get; set; }

    public virtual DbSet<CdholDay> CdholDays { get; set; }

    public virtual DbSet<Area> Areas { get; set; }

    public virtual DbSet<Message> Messages { get; set; }

    public virtual DbSet<MessageHistory> MessageHistories { get; set; }

    public virtual DbSet<Reply> Replies { get; set; }
    public virtual DbSet<MessageStockholder> MessageStockholders { get; set; }

    public virtual DbSet<RequestToken> RequestTokens { get; set; }

    public virtual DbSet<MessagesRelation> MessagesRelations { get; set; }

    public virtual DbSet<SummerUnitFreezeBatch> SummerUnitFreezeBatches { get; set; }

    public virtual DbSet<SummerUnitFreezeDetail> SummerUnitFreezeDetails { get; set; }

    public override int SaveChanges()
    {
        var UserId = _httpContextAccessor.HttpContext?.User?.Claims.FirstOrDefault((Claim u) => u.Type == "UserId").Value;
        //var UserName = _httpContextAccessor.HttpContext?.User?.Claims.FirstOrDefault((Claim u) => u.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname").Value;

        // Track changes for Message only
        var ticketEntries = ChangeTracker.Entries<Message>()
            .Where(e => e.State == EntityState.Modified)
            .ToList();

        foreach (var entry in ticketEntries)
        {
            var ticketId = entry.Entity.MessageId;
            foreach (var property in entry.Properties)
            {
                if (property.IsModified && !property.CurrentValue.Equals(property.OriginalValue))
                {
                    Add(new MessageHistory
                    {
                        MessageId = ticketId,
                        FieldChanged = property.Metadata.Name,
                        OldValue = property.OriginalValue?.ToString(),
                        NewValue = property.CurrentValue?.ToString(),
                        ChangedBy = UserId == null ? "" : UserId,
                        ChangeDate = DateTime.Now
                    }); ;
                }
            }
        }
        var result = base.SaveChanges();

        return result;
    }
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {

        var UserId = _httpContextAccessor.HttpContext?.User?.Claims.FirstOrDefault((Claim u) => u.Type == "UserId").Value;
        //var UserName = _httpContextAccessor.HttpContext?.User?.Claims.FirstOrDefault((Claim u) => u.Type == "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname").Value;

        // Track changes for Message only
        var ticketEntries = ChangeTracker.Entries<Message>()
            .Where(e => e.State == EntityState.Modified)
            .ToList();

        foreach (var entry in ticketEntries)
        {
            var ticketId = entry.Entity.MessageId;
            foreach (var property in entry.Properties)
            {
                if (property.IsModified && !property.CurrentValue.Equals(property.OriginalValue))
                {
                    Add(new MessageHistory
                    {
                        MessageId = ticketId,
                        FieldChanged = property.Metadata.Name,
                        OldValue = property.OriginalValue?.ToString(),
                        NewValue = property.CurrentValue?.ToString(),
                        ChangedBy = UserId == null ? "" : UserId,
                        ChangeDate = DateTime.UtcNow
                    }); ;
                }
            }
        }

        var result = await base.SaveChangesAsync(cancellationToken);
        return result;
    }


    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        //#warning To protect potentially sensitive information in your connection string, you should move it out of source code. You can avoid scaffolding the connection string by using the Name= syntax to read it from configuration - see https://go.microsoft.com/fwlink/?linkid=2131148. For more guidance on storing connection strings, see http://go.microsoft.com/fwlink/?LinkId=723263.
        //=> optionsBuilder.UseSqlServer("Data Source=DEPI-DB;Initial Catalog=VOCA;TrustServerCertificate=true;Persist Security Info=True;User ID=sa;Password=Hemonad105046");
    }



    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Message>()
        .Property(t => t.Priority)
        .HasConversion<byte>(); // Store enum as TINYINT (byte)

        modelBuilder.Entity<Message>()
        .Property(t => t.Status)
        .HasConversion<byte>(); // Store enum as TINYINT (byte)

        // Shadow properties for auto-auditing
        modelBuilder.Entity<Message>()
            .Property<DateTime>("CreatedDate")
            .HasDefaultValueSql("GETUTCDATE()");

        //modelBuilder.Entity<Message>()
        //    .Property("LastModifiedDate")
        //    .HasDefaultValueSql("GETUTCDATE()");




        modelBuilder.UseCollation("Arabic_100_CI_AS");

        modelBuilder.Entity<Application>(entity =>
        {
            entity.Property(e => e.ApplicationId)
                .HasMaxLength(10)
                .HasColumnName("ApplicationID");
            entity.Property(e => e.ApplicationName).HasMaxLength(200);
            entity.Property(e => e.IsActive)
                .IsRequired()
                .HasDefaultValueSql("((1))");
            entity.Property(e => e.StampDate)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
        });

        modelBuilder.Entity<CdCategoryMand>(entity =>
        {
            entity.HasKey(e => e.MendSql).HasName("PK_CdFnMend");

            entity.ToTable("CdCategoryMand");

            entity.Property(e => e.MendSql).HasColumnName("MendSQL");
            entity.Property(e => e.MendField).HasMaxLength(50);
            entity.Property(e => e.MendGroup).HasColumnName("MendGroup");

            entity.HasOne(d => d.MendCategoryNavigation).WithMany(p => p.CdCategoryMands)
                .HasForeignKey(d => d.MendCategory)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CdCategoryMand_CDCategory");

            entity.HasOne(d => d.MendFieldNavigation).WithMany(p => p.CdCategoryMands)
                .HasForeignKey(d => d.MendField)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_CdCategoryMand_CDMend");
        });

        modelBuilder.Entity<Cdcategory>(entity =>
        {
            entity.HasKey(e => e.CatId);

            entity.ToTable("CDCategory");

            entity.Property(e => e.CatId).ValueGeneratedNever();
            entity.Property(e => e.CatMend);
            entity.Property(e => e.Stockholder)
                .HasMaxLength(12)
                .UseCollation("SQL_Latin1_General_CP1_CI_AS");
            entity.Property(e => e.CatName)
                .HasMaxLength(50)
                .UseCollation("SQL_Latin1_General_CP1_CI_AS");
            entity.Property(e => e.CatSms).HasColumnName("CatSMS");
            entity.Property(e => e.Cc)
                .HasMaxLength(100)
                .HasColumnName("Cc_");
            entity.Property(e => e.StampDate)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.To)
                .HasMaxLength(100)
                .HasColumnName("To_");
            entity.Property(e => e.ApplicationId)
                .HasMaxLength(10)
                .HasColumnName("ApplicationID");
        });

        modelBuilder.Entity<MandGroup>(entity =>
        {
            entity.HasKey(e => e.GroupId).HasName("PK__MandGrou__149AF30A79C17F54");

            entity.Property(e => e.GroupId)
                .ValueGeneratedNever()
                .HasColumnName("GroupID");
            entity.Property(e => e.GroupDescription).HasMaxLength(255);
            entity.Property(e => e.GroupName).HasMaxLength(100);
            entity.Property(e => e.IsExtendable).HasColumnName("IsExtendable");
        });

        modelBuilder.Entity<CdholDay>(entity =>
        {
            entity.HasKey(e => e.Hdate);

            entity.ToTable("CDHolDay");

            entity.Property(e => e.Hdate)
                .HasColumnType("date")
                .HasColumnName("HDate");
            entity.Property(e => e.Hconfrm).HasColumnName("HConfrm");
            entity.Property(e => e.Hday)
                .HasMaxLength(9)
                .IsFixedLength()
                .HasColumnName("HDay");
            entity.Property(e => e.HdayW).HasColumnName("HDayW");
            entity.Property(e => e.Hdetails)
                .HasMaxLength(100)
                .IsFixedLength()
                .HasColumnName("HDetails");
            entity.Property(e => e.Hdy).HasColumnName("HDy");
        });

        modelBuilder.Entity<EscProcess>(entity =>
        {
            entity.HasKey(e => e.EscSql);

            entity.ToTable("EscProcess");

            entity.Property(e => e.EscSql).HasColumnName("EscSQL");
            entity.Property(e => e.EscCc)
                .HasMaxLength(255)
                .HasColumnName("EscCC");
            entity.Property(e => e.EscId).HasColumnName("EscID");
            entity.Property(e => e.EscUcatLvl).HasColumnName("EscUCatLvl");
        });

        modelBuilder.Entity<TkmendField>(entity =>
        {
            entity.HasKey(e => e.FildSql).HasName("PK_CDFildMend");

            entity.ToTable("TKMendFields");

            entity.Property(e => e.FildKind).HasMaxLength(50);
            entity.Property(e => e.FildTxt).HasMaxLength(100);
        });

        modelBuilder.Entity<Cdmend>(entity =>
        {
            entity.HasKey(e => e.CdmendTxt);

            entity.ToTable("CDMend");

            entity.Property(e => e.CdmendTxt)
                .HasMaxLength(50)
                .HasColumnName("CDMendTxt");
            entity.Property(e => e.CDMendLbl)
                .HasMaxLength(50)
                .HasColumnName("CDMendLbl");
            entity.Property(e => e.CdmendDatatype)
                .HasMaxLength(50)
                .HasColumnName("CDMendDatatype");
            entity.Property(e => e.CdmendSql).HasColumnName("CDMendSQL");
            entity.Property(e => e.CdmendStat).HasColumnName("CDMendStat");
            entity.Property(e => e.CdmendTbl).HasColumnName("CDMendTbl");
            entity.Property(e => e.Placeholder).HasColumnName("Placeholder");
            entity.Property(e => e.DefaultValue).HasColumnName("DefaultValue");
            entity.Property(e => e.CdmendType)
                .HasMaxLength(50)
                .HasColumnName("CDMendType");
            entity.Property(e => e.Cdmendmask)
                .HasMaxLength(30)
                .HasColumnName("CDMendmask");
            entity.Property(e => e.Email)
                .HasDefaultValueSql("((0))")
                .HasColumnName("email");
            entity.Property(e => e.MaxValue);
            entity.Property(e => e.MinValue);
            entity.Property(e => e.Pattern).HasDefaultValueSql("((0))");
            entity.Property(e => e.Required).HasDefaultValueSql("((0))");
            entity.Property(e => e.RequiredTrue).HasDefaultValueSql("((0))");
            entity.Property(e => e.Width).HasDefaultValueSql("((0))");
            entity.Property(e => e.Height).HasDefaultValueSql("((0))");
            entity.Property(e => e.IsDisabledInit).HasDefaultValueSql("((0))");
            entity.Property(e => e.IsSearchable).HasDefaultValueSql("((0))");
        });

        modelBuilder.Entity<Area>(entity =>
        {
            entity.Property(e => e.AreaId)
                .HasMaxLength(10)
                .HasColumnName("Area_ID");
            entity.Property(e => e.AreaCsUser)
                .HasMaxLength(20)
                .HasColumnName("Area_CS_User");
            entity.Property(e => e.AreaDistributionUser)
                .HasMaxLength(20)
                .HasColumnName("Area_Distribution_User");
            entity.Property(e => e.AreaName)
                .HasMaxLength(50)
                .HasColumnName("Area_Name");
        });

        modelBuilder.Entity<Message>(entity =>
        {
            entity.HasKey(e => e.MessageId).HasName("PK__Messages__712CC6276E2CEC0B");

            entity.HasIndex(e => e.AssignedSectorId, "IX_Messages_AssignedSector");

            entity.HasIndex(e => e.Status, "IX_Messages_Status");

            entity.Property(e => e.MessageId)
                .ValueGeneratedNever()
                .HasColumnName("MessageID");
            entity.Property(e => e.AssignedSectorId)
                .HasMaxLength(20)
                .HasColumnName("AssignedSectorID");
            entity.Property(e => e.ClosedDate).HasColumnType("datetime");
            entity.Property(e => e.CreatedBy).HasMaxLength(20);
            entity.Property(e => e.CreatedDate)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.CurrentResponsibleSectorId)
                .HasMaxLength(20)
                .HasColumnName("CurrentResponsibleSectorID");
            entity.Property(e => e.DueDate).HasColumnType("datetime");
            entity.Property(e => e.RequestRef).HasMaxLength(50);
            entity.Property(e => e.Subject).HasMaxLength(255);

        });

        modelBuilder.Entity<MessageHistory>(entity =>
        {
            entity.HasKey(e => e.HistoryId).HasName("PK__MessageH__4D7B4ADDD8928152");

            entity.ToTable("MessageHistory");

            entity.HasIndex(e => e.MessageId, "IX_MessageHistory_MessageID");

            entity.Property(e => e.HistoryId).HasColumnName("HistoryID");
            entity.Property(e => e.ChangeDate)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.ChangedBy).HasMaxLength(20);
            entity.Property(e => e.FieldChanged).HasMaxLength(50);
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.NewValue).HasMaxLength(255);
            entity.Property(e => e.OldValue).HasMaxLength(255);
        });

        modelBuilder.Entity<Reply>(entity =>
        {
            entity.HasKey(e => e.ReplyId).HasName("PK__Replies__C25E46292517ECF9");

            entity.HasIndex(e => e.MessageId, "IX_Replies_MessageID");

            entity.Property(e => e.ReplyId).HasColumnName("ReplyID");
            entity.Property(e => e.AuthorId)
                .HasMaxLength(20)
                .HasColumnName("AuthorID");
            entity.Property(e => e.CreatedDate)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.Ip)
                .HasMaxLength(15)
                .HasColumnName("IP");
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.NextResponsibleSectorId)
                .HasMaxLength(20)
                .HasColumnName("NextResponsibleSectorID");
        });

        modelBuilder.Entity<MessageStockholder>(entity =>
        {
            entity.HasIndex(e => e.MessageId, "IX_MessageStockholders_MessageID");

            entity.HasIndex(e => new { e.MessageId, e.StockholderId }, "UQ_MessageStockholders_MessageID_StockholderID").IsUnique();

            entity.Property(e => e.MessageStockholderId).HasColumnName("MessageStockholderID");
            entity.Property(e => e.CreatedDate)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");
            entity.Property(e => e.DueDate).HasColumnType("datetime");
            entity.Property(e => e.LastModifiedDate).HasColumnType("datetime");
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.PartyType).HasMaxLength(50);
            entity.Property(e => e.ReceivedDate).HasColumnType("datetime");
            entity.Property(e => e.RepliedDate).HasColumnType("datetime");
            entity.Property(e => e.RequiredResponse).HasDefaultValueSql("((0))");
            entity.Property(e => e.SendDate).HasColumnType("datetime");
            entity.Property(e => e.StockholderId).HasColumnName("StockholderID");
        });

        modelBuilder.Entity<RequestToken>(entity =>
        {
            entity.HasKey(e => e.Token);
            entity.ToTable("RequestTokens");
            entity.Property(e => e.Id).HasColumnName("Id").ValueGeneratedOnAdd();
            entity.Property(e => e.Token).HasMaxLength(200).HasColumnName("Token");
            entity.Property(e => e.TokenHash).HasMaxLength(128).HasColumnName("TokenHash");
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.TokenPurpose).HasMaxLength(100).HasColumnName("TokenPurpose");
            entity.Property(e => e.IsUsed).HasColumnName("IsUsed").HasDefaultValue(false);
            entity.Property(e => e.IsOneTimeUse).HasColumnName("IsOneTimeUse").HasDefaultValue(false);
            entity.Property(e => e.UsedAt).HasColumnType("datetime").HasColumnName("UsedAt");
            entity.Property(e => e.CreatedAt).HasColumnType("datetime").HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.CreatedBy).HasMaxLength(64).HasColumnName("CreatedBy");
            entity.Property(e => e.UserId).HasMaxLength(64).HasColumnName("UserId");
            entity.Property(e => e.ExpiresAt).HasColumnType("datetime");
            entity.Property(e => e.RevokedAt).HasColumnType("datetime").HasColumnName("RevokedAt");
            entity.Property(e => e.RevokedBy).HasMaxLength(64).HasColumnName("RevokedBy");

            entity.HasIndex(e => e.TokenHash, "UX_RequestTokens_TokenHash")
                .IsUnique()
                .HasFilter("[TokenHash] IS NOT NULL");
            entity.HasIndex(e => e.Id, "IX_RequestTokens_Id")
                .IsUnique();
            entity.HasIndex(e => new { e.MessageId, e.TokenPurpose, e.UserId, e.RevokedAt }, "IX_RequestTokens_MessagePurposeUserActive");
        });

        modelBuilder.Entity<MessagesRelation>(entity =>
        {
            entity.ToTable("MESSAGES_RELATION");

            entity.Property(e => e.Id).HasColumnName("ID");
            entity.Property(e => e.MessageId).HasColumnName("MESSAGE_ID");
            entity.Property(e => e.RelatedMessageId).HasColumnName("RELATED_MESSAGE_ID");
            entity.Property(e => e.RelationType)
                .HasMaxLength(50)
                .HasColumnName("RELATION_TYPE");
        });

        modelBuilder.Entity<SummerUnitFreezeBatch>(entity =>
        {
            entity.HasKey(e => e.FreezeId).HasName("PK_SummerUnitFreezeBatches");

            entity.ToTable("SummerUnitFreezeBatches");

            entity.HasIndex(e => new { e.CategoryId, e.WaveCode, e.FamilyCount, e.IsActive }, "IX_SummerUnitFreezeBatches_Search");

            entity.Property(e => e.FreezeId).HasColumnName("FreezeID");
            entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
            entity.Property(e => e.WaveCode)
                .HasMaxLength(50)
                .IsRequired();
            entity.Property(e => e.FamilyCount).HasColumnName("FamilyCount");
            entity.Property(e => e.RequestedUnitsCount).HasColumnName("RequestedUnitsCount");
            entity.Property(e => e.FreezeType)
                .HasMaxLength(50)
                .HasDefaultValue("GENERAL");
            entity.Property(e => e.Reason).HasMaxLength(200);
            entity.Property(e => e.Notes).HasMaxLength(1000);
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(50)
                .IsRequired();
            entity.Property(e => e.CreatedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.ReleasedAtUtc).HasColumnType("datetime2");
            entity.Property(e => e.ReleasedBy).HasMaxLength(50);
        });

        modelBuilder.Entity<SummerUnitFreezeDetail>(entity =>
        {
            entity.HasKey(e => e.FreezeDetailId).HasName("PK_SummerUnitFreezeDetails");

            entity.ToTable("SummerUnitFreezeDetails");

            entity.HasIndex(e => new { e.FreezeId, e.SlotNumber }, "IX_SummerUnitFreezeDetails_Freeze_Slot").IsUnique();
            entity.HasIndex(e => e.AssignedMessageId, "IX_SummerUnitFreezeDetails_AssignedMessage");

            entity.Property(e => e.FreezeDetailId).HasColumnName("FreezeDetailID");
            entity.Property(e => e.FreezeId).HasColumnName("FreezeID");
            entity.Property(e => e.SlotNumber).HasColumnName("SlotNumber");
            entity.Property(e => e.Status)
                .HasMaxLength(40)
                .IsRequired();
            entity.Property(e => e.AssignedMessageId).HasColumnName("AssignedMessageID");
            entity.Property(e => e.AssignedAtUtc).HasColumnType("datetime2");
            entity.Property(e => e.ReleasedAtUtc).HasColumnType("datetime2");
            entity.Property(e => e.ReleasedBy).HasMaxLength(50);
            entity.Property(e => e.LastStatusChangedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasOne(detail => detail.Freeze)
                .WithMany(batch => batch.Details)
                .HasForeignKey(detail => detail.FreezeId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SummerUnitFreezeDetails_Batches");
        });

        modelBuilder.HasSequence<int>("Seq_Categories").StartsAt(101L);
        modelBuilder.HasSequence<int>("Seq_Events").StartsAt(3288721L);
        modelBuilder.HasSequence<int>("Seq_Tickets").StartsAt(631862L);

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
