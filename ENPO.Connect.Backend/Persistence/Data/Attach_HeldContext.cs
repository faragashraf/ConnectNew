using Microsoft.EntityFrameworkCore;
using Models.Attachment;

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

            OnModelCreatingPartial(modelBuilder);
        }

        partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
    }
}
