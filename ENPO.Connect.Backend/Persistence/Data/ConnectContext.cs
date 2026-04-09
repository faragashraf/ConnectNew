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

    public virtual DbSet<AdminCatalogCategoryGroup> AdminCatalogCategoryGroups { get; set; }

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

    public virtual DbSet<SubjectEnvelope> SubjectEnvelopes { get; set; }

    public virtual DbSet<SubjectEnvelopeLink> SubjectEnvelopeLinks { get; set; }

    public virtual DbSet<SubjectReferencePolicy> SubjectReferencePolicies { get; set; }

    public virtual DbSet<SubjectTypeAdminSetting> SubjectTypeAdminSettings { get; set; }

    public virtual DbSet<SubjectTypeRequestAvailability> SubjectTypeRequestAvailabilities { get; set; }

    public virtual DbSet<SubjectCategoryFieldSetting> SubjectCategoryFieldSettings { get; set; }

    public virtual DbSet<SubjectStatusHistory> SubjectStatusHistories { get; set; }

    public virtual DbSet<SubjectTimelineEvent> SubjectTimelineEvents { get; set; }

    public virtual DbSet<SubjectTask> SubjectTasks { get; set; }

    public virtual DbSet<NotificationRule> NotificationRules { get; set; }

    public virtual DbSet<SubjectRoutingProfile> SubjectRoutingProfiles { get; set; }

    public virtual DbSet<SubjectRoutingStep> SubjectRoutingSteps { get; set; }

    public virtual DbSet<SubjectRoutingTarget> SubjectRoutingTargets { get; set; }

    public virtual DbSet<SubjectRoutingTransition> SubjectRoutingTransitions { get; set; }

    public virtual DbSet<SubjectTypeRoutingBinding> SubjectTypeRoutingBindings { get; set; }

    public virtual DbSet<FieldAccessPolicy> FieldAccessPolicies { get; set; }

    public virtual DbSet<FieldAccessPolicyRule> FieldAccessPolicyRules { get; set; }

    public virtual DbSet<FieldAccessLock> FieldAccessLocks { get; set; }

    public virtual DbSet<FieldAccessOverride> FieldAccessOverrides { get; set; }

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
            entity.ToTable("Applications");

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

        modelBuilder.Entity<AdminCatalogCategoryGroup>(entity =>
        {
            entity.HasKey(e => e.GroupId).HasName("PK_AdminCatalogCategoryGroups");

            entity.ToTable("AdminCatalogCategoryGroups");

            entity.HasIndex(e => new { e.CategoryId, e.ParentGroupId, e.DisplayOrder })
                .HasDatabaseName("IX_AdminCatalogCategoryGroups_CategoryParentOrder");

            entity.HasIndex(e => e.ApplicationId)
                .HasDatabaseName("IX_AdminCatalogCategoryGroups_ApplicationID");

            entity.HasIndex(e => new { e.CategoryId, e.ParentGroupId, e.GroupName })
                .IsUnique()
                .HasFilter("([IsActive]=(1))")
                .HasDatabaseName("UX_AdminCatalogCategoryGroups_CategoryParentName");

            entity.Property(e => e.GroupId).ValueGeneratedNever();
            entity.Property(e => e.ApplicationId)
                .HasMaxLength(10)
                .HasColumnName("ApplicationID");
            entity.Property(e => e.CreatedBy).HasColumnName("CreatedBy");
            entity.Property(e => e.GroupDescription).HasMaxLength(255);
            entity.Property(e => e.GroupName).HasMaxLength(200);
            entity.Property(e => e.IsActive).HasDefaultValueSql("((1))");
            entity.Property(e => e.DisplayOrder).HasDefaultValueSql("((0))");
            entity.Property(e => e.StampDate)
                .HasDefaultValueSql("(getdate())")
                .HasColumnType("datetime");

            entity.HasOne(d => d.Category)
                .WithMany(p => p.AdminCatalogCategoryGroups)
                .HasForeignKey(d => d.CategoryId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AdminCatalogCategoryGroups_CDCategory");

            entity.HasOne(d => d.ParentGroup)
                .WithMany(p => p.Children)
                .HasForeignKey(d => d.ParentGroupId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_AdminCatalogCategoryGroups_Parent");
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

        modelBuilder.Entity<SubjectEnvelope>(entity =>
        {
            entity.ToTable("SubjectEnvelopes");

            entity.HasKey(e => e.EnvelopeId).HasName("PK_SubjectEnvelopes");

            entity.Property(e => e.EnvelopeId)
                .HasColumnName("EnvelopeID")
                .ValueGeneratedOnAdd();
            entity.Property(e => e.EnvelopeRef)
                .HasMaxLength(100)
                .IsRequired();
            entity.Property(e => e.IncomingDate)
                .HasColumnType("datetime2")
                .IsRequired();
            entity.Property(e => e.SourceEntity).HasMaxLength(250);
            entity.Property(e => e.DeliveryDelegate).HasMaxLength(250);
            entity.Property(e => e.Notes).HasMaxLength(2000);
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(e => e.CreatedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.LastModifiedBy).HasMaxLength(64);
            entity.Property(e => e.LastModifiedAtUtc).HasColumnType("datetime2");

            entity.HasIndex(e => e.EnvelopeRef, "UX_SubjectEnvelopes_EnvelopeRef")
                .IsUnique();
            entity.HasIndex(e => e.IncomingDate, "IX_SubjectEnvelopes_IncomingDate");
        });

        modelBuilder.Entity<SubjectEnvelopeLink>(entity =>
        {
            entity.ToTable("SubjectEnvelopeLinks");

            entity.HasKey(e => e.EnvelopeLinkId).HasName("PK_SubjectEnvelopeLinks");

            entity.Property(e => e.EnvelopeLinkId)
                .HasColumnName("EnvelopeLinkID")
                .ValueGeneratedOnAdd();
            entity.Property(e => e.EnvelopeId).HasColumnName("EnvelopeID");
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.LinkedBy)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(e => e.LinkedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.EnvelopeId, "IX_SubjectEnvelopeLinks_EnvelopeID");
            entity.HasIndex(e => e.MessageId, "IX_SubjectEnvelopeLinks_MessageID");
            entity.HasIndex(e => new { e.EnvelopeId, e.MessageId }, "UX_SubjectEnvelopeLinks_Envelope_Message")
                .IsUnique();

            entity.HasOne(e => e.Envelope)
                .WithMany(e => e.LinkedSubjects)
                .HasForeignKey(e => e.EnvelopeId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SubjectEnvelopeLinks_SubjectEnvelopes");
        });

        modelBuilder.Entity<SubjectReferencePolicy>(entity =>
        {
            entity.ToTable("SubjectReferencePolicies");

            entity.HasKey(e => e.PolicyId).HasName("PK_SubjectReferencePolicies");

            entity.Property(e => e.PolicyId)
                .HasColumnName("PolicyID")
                .ValueGeneratedOnAdd();
            entity.Property(e => e.CategoryId).HasColumnName("CategoryID");
            entity.Property(e => e.Prefix)
                .HasMaxLength(40)
                .IsRequired();
            entity.Property(e => e.Separator)
                .HasMaxLength(10)
                .HasDefaultValue("-");
            entity.Property(e => e.SourceFieldKeys).HasMaxLength(500);
            entity.Property(e => e.IncludeYear).HasDefaultValue(true);
            entity.Property(e => e.UseSequence).HasDefaultValue(true);
            entity.Property(e => e.SequenceName).HasMaxLength(80);
            entity.Property(e => e.SequencePaddingLength).HasDefaultValue(0);
            entity.Property(e => e.SequenceResetScope)
                .HasMaxLength(16)
                .HasDefaultValue("none");
            entity.Property(e => e.IsActive).HasDefaultValue(true);
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(e => e.CreatedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.LastModifiedBy).HasMaxLength(64);
            entity.Property(e => e.LastModifiedAtUtc).HasColumnType("datetime2");

            entity.HasIndex(e => e.CategoryId, "UX_SubjectReferencePolicies_CategoryID")
                .IsUnique();
            entity.HasIndex(e => e.IsActive, "IX_SubjectReferencePolicies_IsActive");
        });

        modelBuilder.Entity<SubjectTypeAdminSetting>(entity =>
        {
            entity.ToTable("SubjectTypeAdminSettings");

            entity.HasKey(e => e.CategoryId).HasName("PK_SubjectTypeAdminSettings");

            entity.Property(e => e.CategoryId)
                .HasColumnName("CategoryID")
                .ValueGeneratedNever();
            entity.Property(e => e.DisplayOrder).HasDefaultValue(0);
            entity.Property(e => e.SettingsJson);
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(e => e.LastModifiedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.DisplayOrder, "IX_SubjectTypeAdminSettings_DisplayOrder");
        });

        modelBuilder.Entity<SubjectTypeRequestAvailability>(entity =>
        {
            entity.ToTable("SubjectTypeRequestAvailability");

            entity.HasKey(e => e.CategoryId).HasName("PK_SubjectTypeRequestAvailability");

            entity.Property(e => e.CategoryId)
                .HasColumnName("CategoryID")
                .ValueGeneratedNever();
            entity.Property(e => e.AvailabilityMode)
                .HasMaxLength(20)
                .HasDefaultValue("Public")
                .IsRequired();
            entity.Property(e => e.SelectedNodeType)
                .HasMaxLength(20);
            entity.Property(e => e.SelectedNodeNumericId)
                .HasColumnType("decimal(18,0)");
            entity.Property(e => e.SelectedNodeUserId)
                .HasMaxLength(20);
            entity.Property(e => e.SelectionLabelAr)
                .HasMaxLength(300);
            entity.Property(e => e.SelectionPathAr)
                .HasMaxLength(1000);
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.LastModifiedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();

            entity.HasIndex(e => e.AvailabilityMode, "IX_SubjectTypeRequestAvailability_AvailabilityMode");
            entity.HasIndex(e => new { e.SelectedNodeType, e.SelectedNodeNumericId }, "IX_SubjectTypeRequestAvailability_SelectedNodeType_SelectedNodeNumericId");
            entity.HasIndex(e => e.SelectedNodeUserId, "IX_SubjectTypeRequestAvailability_SelectedNodeUserId");

            entity.HasOne<Cdcategory>()
                .WithMany()
                .HasForeignKey(e => e.CategoryId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SubjectTypeRequestAvailability_CDCategory");
        });

        modelBuilder.Entity<SubjectCategoryFieldSetting>(entity =>
        {
            entity.ToTable("SubjectCategoryFieldSettings");

            entity.HasKey(e => e.MendSql).HasName("PK_SubjectCategoryFieldSettings");

            entity.Property(e => e.MendSql)
                .HasColumnName("MendSQL")
                .ValueGeneratedNever();
            entity.Property(e => e.DisplayOrder).HasDefaultValue(0);
            entity.Property(e => e.IsVisible).HasDefaultValue(true);
            entity.Property(e => e.DisplaySettingsJson);
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(e => e.LastModifiedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.DisplayOrder, "IX_SubjectCategoryFieldSettings_DisplayOrder");
            entity.HasIndex(e => e.IsVisible, "IX_SubjectCategoryFieldSettings_IsVisible");
        });

        modelBuilder.Entity<SubjectStatusHistory>(entity =>
        {
            entity.ToTable("SubjectStatusHistory");

            entity.HasKey(e => e.StatusHistoryId).HasName("PK_SubjectStatusHistory");

            entity.Property(e => e.StatusHistoryId)
                .HasColumnName("StatusHistoryID")
                .ValueGeneratedOnAdd();
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.OldStatus).HasColumnName("OldStatus");
            entity.Property(e => e.NewStatus).HasColumnName("NewStatus");
            entity.Property(e => e.Notes).HasMaxLength(1000);
            entity.Property(e => e.ChangedBy)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(e => e.ChangedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.MessageId, "IX_SubjectStatusHistory_MessageID");
            entity.HasIndex(e => e.ChangedAtUtc, "IX_SubjectStatusHistory_ChangedAtUtc");
        });

        modelBuilder.Entity<SubjectTimelineEvent>(entity =>
        {
            entity.ToTable("SubjectTimelineEvents");

            entity.HasKey(e => e.TimelineEventId).HasName("PK_SubjectTimelineEvents");

            entity.Property(e => e.TimelineEventId)
                .HasColumnName("TimelineEventID")
                .ValueGeneratedOnAdd();
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.EventType)
                .HasMaxLength(80)
                .IsRequired();
            entity.Property(e => e.EventTitle)
                .HasMaxLength(250)
                .IsRequired();
            entity.Property(e => e.EventPayloadJson);
            entity.Property(e => e.StatusFrom);
            entity.Property(e => e.StatusTo);
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(e => e.CreatedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");

            entity.HasIndex(e => e.MessageId, "IX_SubjectTimelineEvents_MessageID");
            entity.HasIndex(e => e.CreatedAtUtc, "IX_SubjectTimelineEvents_CreatedAtUtc");
            entity.HasIndex(e => e.EventType, "IX_SubjectTimelineEvents_EventType");
        });

        modelBuilder.Entity<SubjectTask>(entity =>
        {
            entity.ToTable("SubjectTasks");

            entity.HasKey(e => e.TaskId).HasName("PK_SubjectTasks");

            entity.Property(e => e.TaskId)
                .HasColumnName("TaskID")
                .ValueGeneratedOnAdd();
            entity.Property(e => e.MessageId).HasColumnName("MessageID");
            entity.Property(e => e.ActionTitle)
                .HasMaxLength(250)
                .IsRequired();
            entity.Property(e => e.ActionDescription).HasMaxLength(2000);
            entity.Property(e => e.AssignedToUserId).HasMaxLength(64);
            entity.Property(e => e.AssignedUnitId).HasMaxLength(50);
            entity.Property(e => e.Status)
                .HasDefaultValue((byte)0)
                .IsRequired();
            entity.Property(e => e.DueDateUtc).HasColumnType("datetime2");
            entity.Property(e => e.CompletedAtUtc).HasColumnType("datetime2");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(e => e.CreatedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.LastModifiedBy).HasMaxLength(64);
            entity.Property(e => e.LastModifiedAtUtc).HasColumnType("datetime2");

            entity.HasIndex(e => e.MessageId, "IX_SubjectTasks_MessageID");
            entity.HasIndex(e => e.AssignedUnitId, "IX_SubjectTasks_AssignedUnitID");
            entity.HasIndex(e => e.AssignedToUserId, "IX_SubjectTasks_AssignedUserID");
            entity.HasIndex(e => e.Status, "IX_SubjectTasks_Status");
        });

        modelBuilder.Entity<NotificationRule>(entity =>
        {
            entity.ToTable("NotificationRules");

            entity.HasKey(e => e.Id).HasName("PK_NotificationRules");

            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd();
            entity.Property(e => e.SubjectTypeId)
                .HasColumnName("SubjectTypeID")
                .IsRequired();
            entity.Property(e => e.EventType)
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(e => e.RecipientType)
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(e => e.RecipientValue)
                .HasMaxLength(200)
                .IsRequired();
            entity.Property(e => e.Template)
                .HasMaxLength(2000)
                .IsRequired();
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .IsRequired();
            entity.Property(e => e.CreatedAtUtc)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()");
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64);
            entity.Property(e => e.LastModifiedAtUtc)
                .HasColumnType("datetime2");

            entity.HasIndex(e => new { e.SubjectTypeId, e.EventType }, "IX_NotificationRules_SubjectType_EventType");
            entity.HasIndex(e => e.IsActive, "IX_NotificationRules_IsActive");
            entity.HasIndex(
                e => new { e.SubjectTypeId, e.EventType, e.RecipientType, e.RecipientValue },
                "UX_NotificationRules_SubjectType_EventType_Recipient")
                .IsUnique();
        });

        modelBuilder.Entity<SubjectRoutingProfile>(entity =>
        {
            entity.ToTable("SubjectRoutingProfiles");

            entity.HasKey(e => e.Id).HasName("PK_SubjectRoutingProfiles");

            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.SubjectTypeId)
                .HasColumnName("SubjectTypeID")
                .IsRequired();
            entity.Property(e => e.NameAr)
                .HasMaxLength(200)
                .IsRequired();
            entity.Property(e => e.DescriptionAr)
                .HasMaxLength(2000);
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.DirectionMode)
                .HasMaxLength(20)
                .HasDefaultValue("Both")
                .IsRequired();
            entity.Property(e => e.StartStepId)
                .HasColumnName("StartStepID");
            entity.Property(e => e.VersionNo)
                .HasDefaultValue(1)
                .IsRequired();
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.CreatedDate)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64);
            entity.Property(e => e.LastModifiedDate)
                .HasColumnType("datetime2");

            entity.HasIndex(e => new { e.SubjectTypeId, e.IsActive }, "IX_SubjectRoutingProfiles_SubjectType_IsActive");
            entity.HasIndex(e => new { e.SubjectTypeId, e.NameAr }, "UX_SubjectRoutingProfiles_SubjectType_Name")
                .IsUnique();

            entity.HasOne<Cdcategory>()
                .WithMany()
                .HasForeignKey(e => e.SubjectTypeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_SubjectRoutingProfiles_CDCategory");

            entity.HasOne(e => e.StartStep)
                .WithMany()
                .HasForeignKey(e => e.StartStepId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_SubjectRoutingProfiles_StartStep");
        });

        modelBuilder.Entity<SubjectRoutingStep>(entity =>
        {
            entity.ToTable("SubjectRoutingSteps");

            entity.HasKey(e => e.Id).HasName("PK_SubjectRoutingSteps");

            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.RoutingProfileId)
                .HasColumnName("RoutingProfileID")
                .IsRequired();
            entity.Property(e => e.StepCode)
                .HasMaxLength(50)
                .IsRequired();
            entity.Property(e => e.StepNameAr)
                .HasMaxLength(200)
                .IsRequired();
            entity.Property(e => e.StepType)
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(e => e.StepOrder)
                .HasDefaultValue(0)
                .IsRequired();
            entity.Property(e => e.IsStart)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.IsEnd)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.SlaHours);
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.NotesAr)
                .HasMaxLength(1000);
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.CreatedDate)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64);
            entity.Property(e => e.LastModifiedDate)
                .HasColumnType("datetime2");

            entity.HasIndex(e => e.RoutingProfileId, "IX_SubjectRoutingSteps_RoutingProfileID");
            entity.HasIndex(e => new { e.RoutingProfileId, e.StepOrder }, "IX_SubjectRoutingSteps_Profile_Order");
            entity.HasIndex(e => new { e.RoutingProfileId, e.StepCode }, "UX_SubjectRoutingSteps_Profile_StepCode")
                .IsUnique();
            entity.HasIndex(e => new { e.RoutingProfileId, e.IsStart }, "UX_SubjectRoutingSteps_Profile_Start")
                .HasFilter("[IsStart]=(1)")
                .IsUnique();

            entity.HasOne(e => e.RoutingProfile)
                .WithMany(e => e.Steps)
                .HasForeignKey(e => e.RoutingProfileId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SubjectRoutingSteps_SubjectRoutingProfiles");
        });

        modelBuilder.Entity<SubjectRoutingTarget>(entity =>
        {
            entity.ToTable("SubjectRoutingTargets");

            entity.HasKey(e => e.Id).HasName("PK_SubjectRoutingTargets");

            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.RoutingStepId)
                .HasColumnName("RoutingStepID")
                .IsRequired();
            entity.Property(e => e.TargetMode)
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(e => e.OracleUnitTypeId)
                .HasColumnType("decimal(18,0)")
                .HasColumnName("OracleUnitTypeID");
            entity.Property(e => e.OracleOrgUnitId)
                .HasColumnType("decimal(18,0)")
                .HasColumnName("OracleOrgUnitID");
            entity.Property(e => e.PositionId)
                .HasColumnType("decimal(18,0)")
                .HasColumnName("PositionID");
            entity.Property(e => e.PositionCode)
                .HasMaxLength(64);
            entity.Property(e => e.SelectedNodeType)
                .HasMaxLength(30);
            entity.Property(e => e.SelectedNodeNumericId)
                .HasColumnType("decimal(18,0)");
            entity.Property(e => e.SelectedNodeUserId)
                .HasMaxLength(20);
            entity.Property(e => e.AudienceResolutionMode)
                .HasMaxLength(40);
            entity.Property(e => e.WorkDistributionMode)
                .HasMaxLength(40);
            entity.Property(e => e.AllowMultipleReceivers)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.SendToLeaderOnly)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.NotesAr)
                .HasMaxLength(1000);
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.CreatedDate)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64);
            entity.Property(e => e.LastModifiedDate)
                .HasColumnType("datetime2");

            entity.HasIndex(e => e.RoutingStepId, "IX_SubjectRoutingTargets_RoutingStepID");
            entity.HasIndex(e => e.OracleUnitTypeId, "IX_SubjectRoutingTargets_OracleUnitTypeID");
            entity.HasIndex(e => e.OracleOrgUnitId, "IX_SubjectRoutingTargets_OracleOrgUnitID");
            entity.HasIndex(e => e.PositionId, "IX_SubjectRoutingTargets_PositionID");
            entity.HasIndex(e => new { e.SelectedNodeType, e.SelectedNodeNumericId }, "IX_SubjectRoutingTargets_SelectedNodeType_SelectedNodeNumericId");
            entity.HasIndex(e => e.SelectedNodeUserId, "IX_SubjectRoutingTargets_SelectedNodeUserId");

            entity.HasOne(e => e.RoutingStep)
                .WithMany(e => e.Targets)
                .HasForeignKey(e => e.RoutingStepId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SubjectRoutingTargets_SubjectRoutingSteps");
        });

        modelBuilder.Entity<SubjectRoutingTransition>(entity =>
        {
            entity.ToTable("SubjectRoutingTransitions");

            entity.HasKey(e => e.Id).HasName("PK_SubjectRoutingTransitions");

            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.RoutingProfileId)
                .HasColumnName("RoutingProfileID")
                .IsRequired();
            entity.Property(e => e.FromStepId)
                .HasColumnName("FromStepID")
                .IsRequired();
            entity.Property(e => e.ToStepId)
                .HasColumnName("ToStepID")
                .IsRequired();
            entity.Property(e => e.ActionCode)
                .HasMaxLength(50)
                .IsRequired();
            entity.Property(e => e.ActionNameAr)
                .HasMaxLength(200)
                .IsRequired();
            entity.Property(e => e.DisplayOrder)
                .HasDefaultValue(0)
                .IsRequired();
            entity.Property(e => e.RequiresComment)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.RequiresMandatoryFieldsCompletion)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.IsRejectPath)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.IsReturnPath)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.IsEscalationPath)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.ConditionExpression)
                .HasMaxLength(2000);
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.CreatedDate)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64);
            entity.Property(e => e.LastModifiedDate)
                .HasColumnType("datetime2");

            entity.HasIndex(e => e.RoutingProfileId, "IX_SubjectRoutingTransitions_RoutingProfileID");
            entity.HasIndex(e => e.FromStepId, "IX_SubjectRoutingTransitions_FromStepID");
            entity.HasIndex(e => e.ToStepId, "IX_SubjectRoutingTransitions_ToStepID");
            entity.HasIndex(
                e => new { e.RoutingProfileId, e.FromStepId, e.ToStepId, e.ActionCode },
                "UX_SubjectRoutingTransitions_Profile_From_To_Action")
                .IsUnique();

            entity.HasOne(e => e.RoutingProfile)
                .WithMany(e => e.Transitions)
                .HasForeignKey(e => e.RoutingProfileId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SubjectRoutingTransitions_SubjectRoutingProfiles");

            entity.HasOne(e => e.FromStep)
                .WithMany(e => e.FromTransitions)
                .HasForeignKey(e => e.FromStepId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_SubjectRoutingTransitions_FromStep");

            entity.HasOne(e => e.ToStep)
                .WithMany(e => e.ToTransitions)
                .HasForeignKey(e => e.ToStepId)
                .OnDelete(DeleteBehavior.NoAction)
                .HasConstraintName("FK_SubjectRoutingTransitions_ToStep");
        });

        modelBuilder.Entity<SubjectTypeRoutingBinding>(entity =>
        {
            entity.ToTable("SubjectTypeRoutingBindings");

            entity.HasKey(e => e.Id).HasName("PK_SubjectTypeRoutingBindings");

            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.SubjectTypeId)
                .HasColumnName("SubjectTypeID")
                .IsRequired();
            entity.Property(e => e.RoutingProfileId)
                .HasColumnName("RoutingProfileID")
                .IsRequired();
            entity.Property(e => e.IsDefault)
                .HasDefaultValue(false)
                .IsRequired();
            entity.Property(e => e.AppliesToInbound)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.AppliesToOutbound)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.CreatedDate)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64);
            entity.Property(e => e.LastModifiedDate)
                .HasColumnType("datetime2");

            entity.HasIndex(e => e.RoutingProfileId, "IX_SubjectTypeRoutingBindings_RoutingProfileID");
            entity.HasIndex(e => new { e.SubjectTypeId, e.IsActive }, "IX_SubjectTypeRoutingBindings_SubjectType_IsActive");
            entity.HasIndex(
                e => new { e.SubjectTypeId, e.RoutingProfileId },
                "UX_SubjectTypeRoutingBindings_SubjectType_Profile")
                .IsUnique();
            entity.HasIndex(
                e => new { e.SubjectTypeId, e.IsDefault },
                "UX_SubjectTypeRoutingBindings_SubjectType_Default")
                .HasFilter("[IsDefault]=(1) AND [IsActive]=(1)")
                .IsUnique();

            entity.HasOne(e => e.RoutingProfile)
                .WithMany(e => e.Bindings)
                .HasForeignKey(e => e.RoutingProfileId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_SubjectTypeRoutingBindings_SubjectRoutingProfiles");

            entity.HasOne<Cdcategory>()
                .WithMany()
                .HasForeignKey(e => e.SubjectTypeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_SubjectTypeRoutingBindings_CDCategory");
        });

        modelBuilder.Entity<FieldAccessPolicy>(entity =>
        {
            entity.ToTable("FieldAccessPolicies");

            entity.HasKey(e => e.Id).HasName("PK_FieldAccessPolicies");

            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.RequestTypeId)
                .HasColumnName("RequestTypeID")
                .IsRequired();
            entity.Property(e => e.Name)
                .HasMaxLength(200)
                .IsRequired();
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.DefaultAccessMode)
                .HasMaxLength(20)
                .HasDefaultValue("Editable")
                .IsRequired();
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.CreatedDate)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64);
            entity.Property(e => e.LastModifiedDate)
                .HasColumnType("datetime2");

            entity.HasIndex(e => new { e.RequestTypeId, e.IsActive }, "IX_FieldAccessPolicies_RequestType_IsActive");
            entity.HasIndex(e => e.RequestTypeId, "UX_FieldAccessPolicies_RequestType")
                .IsUnique();

            entity.HasOne<Cdcategory>()
                .WithMany()
                .HasForeignKey(e => e.RequestTypeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FieldAccessPolicies_CDCategory");
        });

        modelBuilder.Entity<FieldAccessPolicyRule>(entity =>
        {
            entity.ToTable("FieldAccessPolicyRules");

            entity.HasKey(e => e.Id).HasName("PK_FieldAccessPolicyRules");

            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.PolicyId)
                .HasColumnName("PolicyID")
                .IsRequired();
            entity.Property(e => e.TargetLevel)
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(e => e.TargetId)
                .IsRequired();
            entity.Property(e => e.StageId)
                .HasColumnName("StageID");
            entity.Property(e => e.ActionId)
                .HasColumnName("ActionID");
            entity.Property(e => e.PermissionType)
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(e => e.SubjectType)
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(e => e.SubjectId)
                .HasMaxLength(64);
            entity.Property(e => e.Effect)
                .HasMaxLength(10)
                .HasDefaultValue("Allow")
                .IsRequired();
            entity.Property(e => e.Priority)
                .HasDefaultValue(100)
                .IsRequired();
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.Notes)
                .HasMaxLength(500);
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.CreatedDate)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64);
            entity.Property(e => e.LastModifiedDate)
                .HasColumnType("datetime2");

            entity.HasIndex(e => e.PolicyId, "IX_FieldAccessPolicyRules_PolicyID");
            entity.HasIndex(e => new { e.PolicyId, e.TargetLevel, e.TargetId, e.IsActive }, "IX_FieldAccessPolicyRules_TargetScope");
            entity.HasIndex(e => new { e.PolicyId, e.StageId, e.ActionId, e.IsActive }, "IX_FieldAccessPolicyRules_StageAction");
            entity.HasIndex(e => new { e.PolicyId, e.SubjectType, e.SubjectId }, "IX_FieldAccessPolicyRules_Subject");

            entity.HasOne(e => e.Policy)
                .WithMany(e => e.Rules)
                .HasForeignKey(e => e.PolicyId)
                .OnDelete(DeleteBehavior.Cascade)
                .HasConstraintName("FK_FieldAccessPolicyRules_FieldAccessPolicies");
        });

        modelBuilder.Entity<FieldAccessLock>(entity =>
        {
            entity.ToTable("FieldAccessLocks");

            entity.HasKey(e => e.Id).HasName("PK_FieldAccessLocks");

            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.RequestTypeId)
                .HasColumnName("RequestTypeID")
                .IsRequired();
            entity.Property(e => e.StageId)
                .HasColumnName("StageID");
            entity.Property(e => e.ActionId)
                .HasColumnName("ActionID");
            entity.Property(e => e.TargetLevel)
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(e => e.TargetId)
                .IsRequired();
            entity.Property(e => e.LockMode)
                .HasMaxLength(20)
                .HasDefaultValue("NoEdit")
                .IsRequired();
            entity.Property(e => e.AllowedOverrideSubjectType)
                .HasMaxLength(30);
            entity.Property(e => e.AllowedOverrideSubjectId)
                .HasMaxLength(64);
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();
            entity.Property(e => e.Notes)
                .HasMaxLength(500);
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.CreatedDate)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();
            entity.Property(e => e.LastModifiedBy)
                .HasMaxLength(64);
            entity.Property(e => e.LastModifiedDate)
                .HasColumnType("datetime2");

            entity.HasIndex(e => new { e.RequestTypeId, e.TargetLevel, e.TargetId, e.IsActive }, "IX_FieldAccessLocks_TargetScope");
            entity.HasIndex(e => new { e.RequestTypeId, e.StageId, e.ActionId, e.IsActive }, "IX_FieldAccessLocks_StageAction");

            entity.HasOne<Cdcategory>()
                .WithMany()
                .HasForeignKey(e => e.RequestTypeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FieldAccessLocks_CDCategory");
        });

        modelBuilder.Entity<FieldAccessOverride>(entity =>
        {
            entity.ToTable("FieldAccessOverrides");

            entity.HasKey(e => e.Id).HasName("PK_FieldAccessOverrides");

            entity.Property(e => e.Id).ValueGeneratedOnAdd();
            entity.Property(e => e.RequestId)
                .HasColumnName("RequestID");
            entity.Property(e => e.RequestTypeId)
                .HasColumnName("RequestTypeID");
            entity.Property(e => e.RuleId)
                .HasColumnName("RuleID");
            entity.Property(e => e.TargetLevel)
                .HasMaxLength(20);
            entity.Property(e => e.TargetId);
            entity.Property(e => e.SubjectType)
                .HasMaxLength(30)
                .IsRequired();
            entity.Property(e => e.SubjectId)
                .HasMaxLength(64);
            entity.Property(e => e.OverridePermissionType)
                .HasMaxLength(20)
                .IsRequired();
            entity.Property(e => e.Reason)
                .HasMaxLength(500);
            entity.Property(e => e.GrantedBy)
                .HasMaxLength(64)
                .HasDefaultValue("SYSTEM")
                .IsRequired();
            entity.Property(e => e.GrantedAt)
                .HasColumnType("datetime2")
                .HasDefaultValueSql("GETUTCDATE()")
                .IsRequired();
            entity.Property(e => e.ExpiresAt)
                .HasColumnType("datetime2");
            entity.Property(e => e.IsActive)
                .HasDefaultValue(true)
                .IsRequired();

            entity.HasIndex(e => new { e.RequestId, e.IsActive }, "IX_FieldAccessOverrides_Request_IsActive");
            entity.HasIndex(e => new { e.RequestTypeId, e.IsActive }, "IX_FieldAccessOverrides_RequestType_IsActive");
            entity.HasIndex(e => new { e.TargetLevel, e.TargetId, e.IsActive }, "IX_FieldAccessOverrides_Target_IsActive");

            entity.HasOne<Cdcategory>()
                .WithMany()
                .HasForeignKey(e => e.RequestTypeId)
                .OnDelete(DeleteBehavior.Restrict)
                .HasConstraintName("FK_FieldAccessOverrides_CDCategory");

            entity.HasOne(e => e.Rule)
                .WithMany()
                .HasForeignKey(e => e.RuleId)
                .OnDelete(DeleteBehavior.SetNull)
                .HasConstraintName("FK_FieldAccessOverrides_FieldAccessPolicyRules");
        });

        modelBuilder.HasSequence<int>("Seq_Categories").StartsAt(101L);
        modelBuilder.HasSequence<int>("Seq_Events").StartsAt(3288721L);
        modelBuilder.HasSequence<int>("Seq_Tickets").StartsAt(631862L);

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
