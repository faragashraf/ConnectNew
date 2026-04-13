using Microsoft.EntityFrameworkCore;
using Models.Attachment;
using Models.Correspondance;

namespace Persistence.Data
{
    public partial class Attach_HeldContext : DbContext
    {
        public Attach_HeldContext()
        {
        }

        public Attach_HeldContext(DbContextOptions<Attach_HeldContext> options)
            : base(options)
        {

        }

        public virtual DbSet<AttchShipment> AttchShipments { get; set; }
        public virtual DbSet<AttachmentValidationDocumentType> AttachmentValidationDocumentTypes { get; set; }
        public virtual DbSet<AttachmentValidationRule> AttachmentValidationRules { get; set; }
        public virtual DbSet<AttachmentValidationDocumentTypeRule> AttachmentValidationDocumentTypeRules { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.UseCollation("Arabic_100_CS_AI");

            modelBuilder.Entity<AttchShipment>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.ToTable("Attch_shipment");
                entity.Property(e => e.AttcExt).HasMaxLength(10);
                entity.Property(e => e.AttchId).HasColumnName("AttchID");
                entity.Property(e => e.ApplicationName).HasColumnName("ApplicationName");
                entity.Property(e => e.AttchImg).HasColumnType("image");
                entity.Property(e => e.Id).ValueGeneratedOnAdd().HasColumnName("id");
            });

            modelBuilder.Entity<AttachmentValidationDocumentType>(entity =>
            {
                entity.ToTable("AttachmentValidationDocumentTypes");

                entity.HasKey(e => e.Id).HasName("PK_AttachmentValidationDocumentTypes");

                entity.Property(e => e.Id).ValueGeneratedOnAdd();
                entity.Property(e => e.DocumentTypeCode)
                    .HasMaxLength(100)
                    .IsRequired();
                entity.Property(e => e.DocumentTypeNameAr)
                    .HasMaxLength(200)
                    .IsRequired();
                entity.Property(e => e.DescriptionAr)
                    .HasMaxLength(1000);
                entity.Property(e => e.ValidationMode)
                    .HasMaxLength(30)
                    .HasDefaultValue("UploadOnly")
                    .IsRequired();
                entity.Property(e => e.IsValidationRequired)
                    .HasDefaultValue(false)
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

                entity.HasIndex(e => e.IsActive, "IX_AttachmentValidationDocumentTypes_IsActive");
                entity.HasIndex(e => e.DocumentTypeCode, "UX_AttachmentValidationDocumentTypes_DocumentTypeCode")
                    .IsUnique();
            });

            modelBuilder.Entity<AttachmentValidationRule>(entity =>
            {
                entity.ToTable("AttachmentValidationRules");

                entity.HasKey(e => e.Id).HasName("PK_AttachmentValidationRules");

                entity.Property(e => e.Id).ValueGeneratedOnAdd();
                entity.Property(e => e.RuleCode)
                    .HasMaxLength(100)
                    .IsRequired();
                entity.Property(e => e.RuleNameAr)
                    .HasMaxLength(200)
                    .IsRequired();
                entity.Property(e => e.DescriptionAr)
                    .HasMaxLength(1000);
                entity.Property(e => e.ParameterSchemaJson);
                entity.Property(e => e.IsSystemRule)
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

                entity.HasIndex(e => e.IsActive, "IX_AttachmentValidationRules_IsActive");
                entity.HasIndex(e => e.RuleCode, "UX_AttachmentValidationRules_RuleCode")
                    .IsUnique();
            });

            modelBuilder.Entity<AttachmentValidationDocumentTypeRule>(entity =>
            {
                entity.ToTable("AttachmentValidationDocumentTypeRules");

                entity.HasKey(e => e.Id).HasName("PK_AttachmentValidationDocumentTypeRules");

                entity.Property(e => e.Id).ValueGeneratedOnAdd();
                entity.Property(e => e.DocumentTypeId)
                    .HasColumnName("DocumentTypeID")
                    .IsRequired();
                entity.Property(e => e.RuleId)
                    .HasColumnName("RuleID")
                    .IsRequired();
                entity.Property(e => e.RuleOrder)
                    .HasDefaultValue(100)
                    .IsRequired();
                entity.Property(e => e.IsActive)
                    .HasDefaultValue(true)
                    .IsRequired();
                entity.Property(e => e.IsRequired)
                    .HasDefaultValue(true)
                    .IsRequired();
                entity.Property(e => e.StopOnFailure)
                    .HasDefaultValue(true)
                    .IsRequired();
                entity.Property(e => e.FailureMessageAr)
                    .HasMaxLength(500);
                entity.Property(e => e.ParametersJson);
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

                entity.HasIndex(e => new { e.DocumentTypeId, e.IsActive }, "IX_AttachmentValidationDocumentTypeRules_DocumentType_IsActive");
                entity.HasIndex(e => e.RuleId, "IX_AttachmentValidationDocumentTypeRules_RuleID");
                entity.HasIndex(e => new { e.DocumentTypeId, e.RuleId }, "UX_AttachmentValidationDocumentTypeRules_DocumentType_Rule")
                    .IsUnique();

                entity.HasOne(e => e.DocumentType)
                    .WithMany(e => e.Rules)
                    .HasForeignKey(e => e.DocumentTypeId)
                    .OnDelete(DeleteBehavior.Cascade)
                    .HasConstraintName("FK_AttachmentValidationDocumentTypeRules_DocumentTypes");

                entity.HasOne(e => e.Rule)
                    .WithMany(e => e.DocumentTypeRules)
                    .HasForeignKey(e => e.RuleId)
                    .OnDelete(DeleteBehavior.Restrict)
                    .HasConstraintName("FK_AttachmentValidationDocumentTypeRules_Rules");
            });

            OnModelCreatingPartial(modelBuilder);
        }

        partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
    }
}
