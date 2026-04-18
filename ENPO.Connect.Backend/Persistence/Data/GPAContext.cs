using Microsoft.EntityFrameworkCore;
using Models.GPA;
using Models.GPA.AdminCer;
using Models.GPA.LTRA;
using Models.GPA.OrgStructure;
using Models.Models;

namespace Persistence.Data;

public partial class GPAContext : DbContext
{
    public GPAContext()
    {
    }

    public GPAContext(DbContextOptions<GPAContext> options)
        : base(options)
    {
    }

    public virtual DbSet<AreasList> AreasLists { get; set; }

    public virtual DbSet<LtraRegistration> LtraRegistrations { get; set; }

    public virtual DbSet<VwLtraTransTraficPrint> VwLtraTransTraficPrints { get; set; }

    public virtual DbSet<Tracking> Tracking { get; set; }

    public virtual DbSet<PosUserTeam> PosUserTeams { get; set; }

    public virtual DbSet<EnpoTeamStructure> EnpoTeamStructures { get; set; }

    public virtual DbSet<AdmCertDept> AdmCertDepts { get; set; }

    public virtual DbSet<AdmCertDeptUser> AdmCertDeptUsers { get; set; }

    public virtual DbSet<PosUser> PosUsers { get; set; }

    public virtual DbSet<OrgUnit> OrgUnits { get; set; }

    public virtual DbSet<OrgUnitType> OrgUnitTypes { get; set; }

    public virtual DbSet<UserPosition> UserPositions { get; set; }

    public virtual DbSet<VwOrgUnitsWithCount> VwOrgUnitsWithCounts { get; set; }

    public virtual DbSet<PredefinedSqlStatement> PredefinedSqlStatements { get; set; }



    [DbFunction("REGEXP_SUBSTR", IsBuiltIn = true)]
    public static string RegexpSubstr(string source, string pattern, int position, int occurrence)
    => throw new NotSupportedException(); // EF will translate to SQL


    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {

    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("GPA_USER");

        modelBuilder.Entity<Office>(entity =>
        {
            entity.HasKey(e => e.OfficeId).HasName("OFFICES_PK");

            entity.ToTable("OFFICES");

            entity.HasIndex(e => new { e.OfficeId, e.AreaId }, "OFFC_AREA_IDX");

            entity.Property(e => e.OfficeId)
                .HasMaxLength(50)
                .IsUnicode(false)

                .HasColumnName("OFFICE_ID");
            entity.Property(e => e.AreaId)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasColumnName("AREA_ID");
            entity.Property(e => e.BarcodeUnitId)
                .HasMaxLength(50)
                .IsUnicode(false)

                .HasColumnName("BARCODE_UNIT_ID");
            entity.Property(e => e.BoxesAvailFlag)
                .HasMaxLength(1)
                .IsUnicode(false)

                .HasColumnName("BOXES_AVAIL_FLAG");
            entity.Property(e => e.Centerordistrict)
                .HasMaxLength(50)
                .IsUnicode(false)

                .HasColumnName("CENTERORDISTRICT");
            entity.Property(e => e.ComputeriedOfficeFlag)
                .HasMaxLength(2)
                .IsUnicode(false)

                .HasColumnName("COMPUTERIED_OFFICE_FLAG");
            entity.Property(e => e.CreditorAccountNumber)
                .HasPrecision(10)

                .HasColumnName("CREDITOR_ACCOUNT_NUMBER");
            entity.Property(e => e.CustomsOfficeId)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasColumnName("CUSTOMS_OFFICE_ID");
            entity.Property(e => e.DbName)
                .HasMaxLength(12)
                .IsUnicode(false)

                .IsFixedLength()
                .HasColumnName("DB_NAME");
            entity.Property(e => e.DefaultBoxId)
                .HasPrecision(6)

                .HasColumnName("DEFAULT_BOX_ID");
            entity.Property(e => e.DeliveryCounterLoc)
                .HasMaxLength(60)
                .IsUnicode(false)

                .HasColumnName("DELIVERY_COUNTER_LOC");
            entity.Property(e => e.DetailedAddress)
                .HasMaxLength(200)
                .IsUnicode(false)

                .HasColumnName("DETAILED_ADDRESS");
            entity.Property(e => e.EmHeadOfficeFlag)
                .HasMaxLength(1)
                .IsUnicode(false)

                .HasColumnName("EM_HEAD_OFFICE_FLAG");
            entity.Property(e => e.EmirateId)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasColumnName("EMIRATE_ID");
            entity.Property(e => e.HoId)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasColumnName("HO_ID");
            entity.Property(e => e.ItemDestnOffice)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasColumnName("ITEM_DESTN_OFFICE");
            entity.Property(e => e.LastModifiedDate)

                .HasColumnType("DATE")
                .HasColumnName("LAST_MODIFIED_DATE");
            entity.Property(e => e.LocationCounter)
                .HasPrecision(12)

                .HasColumnName("LOCATION_COUNTER");
            entity.Property(e => e.LocationCounterCas)
                .HasPrecision(12)

                .HasColumnName("LOCATION_COUNTER_CAS");
            entity.Property(e => e.LocationCounterCasLoc)
                .HasPrecision(12)

                .HasColumnName("LOCATION_COUNTER_CAS_LOC");
            entity.Property(e => e.LocationCounterEid)
                .HasPrecision(12)

                .HasColumnName("LOCATION_COUNTER_EID");
            entity.Property(e => e.LocationCounterEidEms)
                .HasPrecision(12)

                .HasDefaultValueSql("0")
                .HasColumnName("LOCATION_COUNTER_EID_EMS");
            entity.Property(e => e.LocationCounterLab)
                .HasPrecision(12)

                .HasColumnName("LOCATION_COUNTER_LAB");
            entity.Property(e => e.LocationCounterLarg)
                .HasPrecision(12)

                .HasColumnName("LOCATION_COUNTER_LARG");
            entity.Property(e => e.LocationCounterLargLoc)
                .HasPrecision(12)

                .HasColumnName("LOCATION_COUNTER_LARG_LOC");
            entity.Property(e => e.LocationCounterLoc)
                .HasPrecision(12)

                .HasColumnName("LOCATION_COUNTER_LOC");
            entity.Property(e => e.MainAccountId)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasColumnName("MAIN_ACCOUNT_ID");
            entity.Property(e => e.MainOfficeId)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasColumnName("MAIN_OFFICE_ID");
            entity.Property(e => e.OfficeAName)
                .HasMaxLength(80)
                .IsUnicode(false)

                .HasColumnName("OFFICE_A_NAME");
            entity.Property(e => e.OfficeChaId)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasColumnName("OFFICE_CHA_ID");
            entity.Property(e => e.OfficeDispFlag)
                .HasMaxLength(1)
                .IsUnicode(false)

                .HasColumnName("OFFICE_DISP_FLAG");
            entity.Property(e => e.OfficeEName)
                .HasMaxLength(40)
                .IsUnicode(false)

                .HasColumnName("OFFICE_E_NAME");
            entity.Property(e => e.OfficeHeadFlag)
                .HasMaxLength(1)
                .IsUnicode(false)

                .HasColumnName("OFFICE_HEAD_FLAG");
            entity.Property(e => e.OfficeInterDispFlag)
                .HasMaxLength(1)
                .IsUnicode(false)

                .HasColumnName("OFFICE_INTER_DISP_FLAG");
            entity.Property(e => e.OfficeStartAutoDate)

                .HasColumnType("DATE")
                .HasColumnName("OFFICE_START_AUTO_DATE");
            entity.Property(e => e.OfficeType)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasColumnName("OFFICE_TYPE");
            entity.Property(e => e.OnlinePaymentCounter)
                .HasPrecision(17)

                .HasColumnName("ONLINE_PAYMENT_COUNTER");
            entity.Property(e => e.ParcelAdviceStatus)
                .HasMaxLength(1)
                .IsUnicode(false)

                .HasColumnName("PARCEL_ADVICE_STATUS");
        });

        modelBuilder.Entity<AreasList>(entity =>
        {
            entity.HasKey(e => e.AreaId);

            entity.ToTable("AREAS_LIST");

            entity.Property(e => e.AreaId)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("AREA_ID");
            entity.Property(e => e.AreaAName)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("AREA_A_NAME");
            entity.Property(e => e.AreaEName)
                .HasMaxLength(40)
                .IsUnicode(false)
                .HasColumnName("AREA_E_NAME");
            entity.Property(e => e.BarcodeUnitId)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("BARCODE_UNIT_ID");
            entity.Property(e => e.DefaultTc)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("DEFAULT_TC");
            entity.Property(e => e.DefaultTcIntId)
                .HasPrecision(6)
                .HasColumnName("DEFAULT_TC_INT_ID");
            entity.Property(e => e.InvalidOffline)
                .HasDefaultValueSql("0\n")
                .HasColumnType("NUMBER(38)")
                .HasColumnName("INVALID_OFFLINE");
            entity.Property(e => e.LastModifiedDate)
                .ValueGeneratedOnAdd()
                .HasColumnType("DATE")
                .HasColumnName("LAST_MODIFIED_DATE");
        });

        modelBuilder.Entity<PosUser>(entity =>
        {
            entity.HasKey(e => e.UserId).HasName("POS_USER_PK");

            entity.ToTable("CONNECT_USERS");

            entity.HasIndex(e => e.NationalId, "NATIONAL_ID_UNIQUE_CONSTRAINT").IsUnique();

            entity.Property(e => e.UserId)
                .HasMaxLength(20)
                .IsUnicode(false)

                .HasColumnName("USER_ID");
            entity.Property(e => e.ArabicName)
                .HasMaxLength(60)
                .IsUnicode(false)

                .HasColumnName("ARABIC_NAME");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(20)
                .IsUnicode(false)

                .HasColumnName("CREATED_BY");
            entity.Property(e => e.CreatedOn)

                .HasDefaultValueSql("SYSDATE ")
                .HasColumnType("DATE")
                .HasColumnName("CREATED_ON");
            entity.Property(e => e.EffectiveDateFrom)

                .HasDefaultValueSql("SYSDATE ")
                .HasColumnType("DATE")
                .HasColumnName("EFFECTIVE_DATE_FROM");
            entity.Property(e => e.EffectiveDateTo)

                .HasDefaultValueSql("TO_DATE('31/12/9999','dd/mm/yyyy') ")
                .HasColumnType("DATE")
                .HasColumnName("EFFECTIVE_DATE_TO");
            entity.Property(e => e.EmailAddress)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("EMAIL_ADDRESS");
            entity.Property(e => e.FirstName)
                .HasMaxLength(50)
                .IsUnicode(false)

                .HasColumnName("FIRST_NAME");
            entity.Property(e => e.LastName)
                .HasMaxLength(50)
                .IsUnicode(false)

                .HasColumnName("LAST_NAME");
            entity.Property(e => e.LastPasswordDate)

                .HasDefaultValueSql("SYSDATE")
                .HasColumnType("DATE")
                .HasColumnName("LAST_PASSWORD_DATE");
            entity.Property(e => e.LastUpdated)

                .HasDefaultValueSql("SYSDATE ")
                .HasColumnType("DATE")
                .HasColumnName("LAST_UPDATED");
            entity.Property(e => e.LastUpdatedBy)
                .HasMaxLength(20)
                .IsUnicode(false)

                .HasColumnName("LAST_UPDATED_BY");
            entity.Property(e => e.LoginStatus)
                .HasMaxLength(1)
                .IsUnicode(false)

                .HasDefaultValueSql("0")
                .HasColumnName("LOGIN_STATUS");
            entity.Property(e => e.MobileNumber)
                .HasMaxLength(50)
                .IsUnicode(false)

                .HasColumnName("MOBILE_NUMBER");
            entity.Property(e => e.NationalId)
                .HasPrecision(14)

                .HasColumnName("NATIONAL_ID");
            entity.Property(e => e.NextPasswordDate)

                .HasColumnType("DATE")
                .HasColumnName("NEXT_PASSWORD_DATE");
            entity.Property(e => e.Password)
                .HasMaxLength(150)
                .IsUnicode(false)

                .HasColumnName("PASSWORD");
            entity.Property(e => e.PreferedLanguage)
                .HasMaxLength(10)
                .IsUnicode(false)

                .HasDefaultValueSql("'''''EN''''' ")
                .HasColumnName("PREFERED_LANGUAGE");
            entity.Property(e => e.ResetPassword)
                .HasPrecision(1)

                .HasDefaultValueSql("0 ")
                .HasColumnName("RESET_PASSWORD");
            entity.Property(e => e.Status)
                .HasPrecision(10)

                .HasDefaultValueSql("0 ")
                .HasColumnName("STATUS");
        });

        modelBuilder.Entity<LtraRegistration>(entity =>
        {
            // Define composite primary key using Barcode and PlateNumber
            entity.HasKey(e => new { e.Barcode, e.PlateNumber });
                entity.ToTable("LTRA_REGISTRATION");
            entity.Property(e => e.AreaAName)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("AREA_A_NAME");
            entity.Property(e => e.Barcode)
                .HasMaxLength(13)
                .IsUnicode(false)
                .HasColumnName("BARCODE");
            entity.Property(e => e.ChassisNumber)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("CHASSIS_NUMBER");
            entity.Property(e => e.ClientIp)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("CLIENT_IP");
            entity.Property(e => e.CommercialRegistration)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("COMMERCIAL_REGISTRATION");
            entity.Property(e => e.CompanyAddress)
                .HasMaxLength(512)
                .IsUnicode(false)
                .HasColumnName("COMPANY_ADDRESS");
            entity.Property(e => e.CompanyName)
                .HasMaxLength(1024)
                .IsUnicode(false)
                .HasColumnName("COMPANY_NAME");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("sysdate\n")
                .HasColumnType("DATE")
                .HasColumnName("CREATED_AT");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CREATED_BY");
            entity.Property(e => e.EngineNumber)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("ENGINE_NUMBER");
            entity.Property(e => e.GovernorateId)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("GOVERNORATE_ID");
            entity.Property(e => e.IdentifierNumber)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("IDENTIFIER_NUMBER");
            entity.Property(e => e.IsPrint)
                .HasPrecision(1)
                .HasDefaultValueSql("0\n")
                .HasColumnName("IS_PRINT");
            entity.Property(e => e.Ispay)
                .HasMaxLength(2)
                .IsUnicode(false)
                .HasDefaultValueSql("0\n")
                .HasColumnName("ISPAY");
            entity.Property(e => e.LicenseDuration)
                .HasColumnType("NUMBER")
                .HasColumnName("LICENSE_DURATION");
            entity.Property(e => e.LicensesNum)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("LICENSES_NUM");
            entity.Property(e => e.ModelBody)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("MODEL_BODY");
            entity.Property(e => e.NumberOfSeats)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("NUMBER_OF_SEATS");
            entity.Property(e => e.NumberOfVehicles)
                .HasColumnType("NUMBER")
                .HasColumnName("NUMBER_OF_VEHICLES");
            entity.Property(e => e.OfficeAName)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("OFFICE_A_NAME");
            entity.Property(e => e.PhoneNumber)
                .HasMaxLength(15)
                .IsUnicode(false)
                .HasColumnName("PHONE_NUMBER");
            entity.Property(e => e.PlateNumber)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("PLATE_NUMBER");
            entity.Property(e => e.PlateNumberLtra)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("PLATE_NUMBER_LTRA");
            entity.Property(e => e.PlateType)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("PLATE_TYPE");
            entity.Property(e => e.ReplyActivityType)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("REPLY_ACTIVITY_TYPE");
            entity.Property(e => e.ReplyActivityTypeCar)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasDefaultValueSql("0")
                .HasColumnName("REPLY_ACTIVITY_TYPE_CAR");
            entity.Property(e => e.ReplyCollectionAmount)
                .HasColumnType("NUMBER")
                .HasColumnName("REPLY_COLLECTION_AMOUNT");
            entity.Property(e => e.ReplyDate)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasDefaultValueSql("SYSDATE\n")
                .HasColumnName("REPLY_DATE");
            entity.Property(e => e.ReplyLicenseFrom)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("REPLY_LICENSE_FROM");
            entity.Property(e => e.ReplyLicenseTo)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("REPLY_LICENSE_TO");
            entity.Property(e => e.ReplyRequestFees)
                .HasColumnType("NUMBER")
                .HasColumnName("REPLY_REQUEST_FEES");
            entity.Property(e => e.ReplyRequestStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("REPLY_REQUEST_STATUS");
            entity.Property(e => e.ReplyStatus)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("REPLY_STATUS");
            entity.Property(e => e.ReplySubject)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("REPLY_SUBJECT");
            entity.Property(e => e.RequireOperationCard)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("REQUIRE_OPERATION_CARD");
            entity.Property(e => e.RequireTrafficLetter)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("REQUIRE_TRAFFIC_LETTER");
            entity.Property(e => e.ResponsibleManager)
                .HasMaxLength(256)
                .IsUnicode(false)
                .HasColumnName("RESPONSIBLE_MANAGER");
            entity.Property(e => e.RlttBarcode)
                .HasMaxLength(13)
                .IsUnicode(false)
                .HasColumnName("RLTT_BARCODE");
            entity.Property(e => e.ServiceId)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("SERVICE_ID");
            entity.Property(e => e.TaxCard)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("TAX_CARD");
            entity.Property(e => e.TrafficUnitId)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("TRAFFIC_UNIT_ID");
            entity.Property(e => e.TransDate)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("TRANS_DATE");
            entity.Property(e => e.TransId)
                .HasMaxLength(64)
                .IsUnicode(false)
                .HasColumnName("TRANS_ID");
            entity.Property(e => e.VehicleBrand)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("VEHICLE_BRAND");
            entity.Property(e => e.YearOfManufacture)
                .HasMaxLength(4)
                .IsUnicode(false)
                .HasColumnName("YEAR_OF_MANUFACTURE");
        });

        modelBuilder.Entity<VwLtraTransTraficPrint>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("VW_LTRA_TRANS_TRAFIC_PRINT");

            entity.Property(e => e.Barcode)
                .HasMaxLength(13)
                .IsUnicode(false)
                .HasColumnName("BARCODE");
            entity.Property(e => e.RlttBarcode)
                .HasMaxLength(13)
                .IsUnicode(false)
                .HasColumnName("RLTT_BARCODE");
            entity.Property(e => e.CarActivity)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("CAR_ACTIVITY");
            entity.Property(e => e.ChassisNumber)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("CHASSIS_NUMBER");
            entity.Property(e => e.CompanyName)
                .HasMaxLength(1024)
                .IsUnicode(false)
                .HasColumnName("COMPANY_NAME");
            entity.Property(e => e.EngineNumber)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("ENGINE_NUMBER");
            entity.Property(e => e.GovernorateId)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("GOVERNORATE_ID");
            entity.Property(e => e.IsPrint)
                .HasPrecision(1)
                .HasColumnName("IS_PRINT");
            entity.Property(e => e.LicenseDuration)
                .HasColumnType("NUMBER")
                .HasColumnName("LICENSE_DURATION");
            entity.Property(e => e.LicensesNum)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("LICENSES_NUM");
            entity.Property(e => e.ModelBody)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("MODEL_BODY");
            entity.Property(e => e.NumberOfSeats)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("NUMBER_OF_SEATS");
            entity.Property(e => e.PlateNumber)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("PLATE_NUMBER");
            entity.Property(e => e.PlateNumberPrint)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("PLATE_NUMBER_PRINT");
            entity.Property(e => e.ReplyLicenseFrom)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("REPLY_LICENSE_FROM");
            entity.Property(e => e.TrafficUnitId)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("TRAFFIC_UNIT_ID");
            entity.Property(e => e.TransDate)
                .HasColumnType("DATE")
                .HasColumnName("TRANS_DATE");
            entity.Property(e => e.TransId)
                .HasMaxLength(64)
                .IsUnicode(false)
                .HasColumnName("TRANS_ID");
            entity.Property(e => e.VehicleBrand)
                .HasMaxLength(500)
                .IsUnicode(false)
                .HasColumnName("VEHICLE_BRAND");
            entity.Property(e => e.YearOfManufacture)
                .HasMaxLength(4)
                .IsUnicode(false)
                .HasColumnName("YEAR_OF_MANUFACTURE");
        });

        modelBuilder.Entity<Tracking>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity
                .ToTable("TRACKING");

            entity.HasIndex(e => e.Id, "TRACK_PRICING_PK").IsUnique();

            entity.Property(e => e.ApplicationName)
                .HasMaxLength(100)
                .HasColumnName("APPLICATION_NAME");
            entity.Property(e => e.CountryId)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("COUNTRY_ID");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CREATED_BY");
            entity.Property(e => e.CreationDate)
                .HasDefaultValueSql("sysdate\n")
                .HasColumnType("DATE")
                .HasColumnName("CREATION_DATE");
            entity.Property(e => e.DepartmentId)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("DEPARTMENT_ID");
            entity.Property(e => e.Description)
                .IsUnicode(false)
                .HasColumnName("DESCRIPTION");
            entity.Property(e => e.FileName)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("FILE_NAME");
            entity.Property(e => e.Id)
                .ValueGeneratedOnAdd()
                .HasColumnType("NUMBER")
                .HasColumnName("ID");
            entity.Property(e => e.PostType)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("POST_TYPE");
            entity.Property(e => e.ServiceType)
                .HasMaxLength(100)
                .IsUnicode(false)
                .HasColumnName("SERVICE_TYPE");
            entity.Property(e => e.TableName)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("TABLE_NAME");
            entity.Property(e => e.TransId)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("TRANS_ID");
        });

        modelBuilder.Entity<PosUserTeam>(entity =>
        {
            entity.HasKey(e => new { e.UserId, e.TeamId }).HasName("POS_USER_CATEGORY_PK");

            entity.ToTable("POS_USER_TEAM");

            entity.Property(e => e.UserId)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("USER_ID");
            entity.Property(e => e.TeamId)
                .HasColumnType("NUMBER")
                .HasColumnName("TEAM_ID");
            entity.Property(e => e.IsActive)
                .HasColumnType("NUMBER")
                .HasColumnName("IS_ACTIVE");
        });

        modelBuilder.Entity<EnpoTeamStructure>(entity =>
        {
            entity.HasKey(e => new { e.Id });
            entity
                .ToTable("ENPO_TEAM_STRUCTURE");

            entity.Property(e => e.Id)
                .HasColumnType("NUMBER")
                .HasColumnName("ID");
            entity.Property(e => e.IsSinglePosition)
                .HasPrecision(1)
                .HasDefaultValueSql("0\n")
                .HasColumnName("IS_SINGLE_POSITION");
            entity.Property(e => e.NameAr)
                .HasMaxLength(150)
                .IsUnicode(false)
                .HasColumnName("NAME_AR");
            entity.Property(e => e.ParentId)
                .HasColumnType("NUMBER")
                .HasColumnName("PARENT_ID");
        });

        modelBuilder.Entity<AdmCertDept>(entity =>
        {
            entity.HasKey(e => e.DepartmentId);

            entity.ToTable("ADM_CERT_DEPT");

            entity.Property(e => e.DepartmentId)
                .HasPrecision(10)
                .HasColumnName("DEPARTMENT_ID");
            entity.Property(e => e.AreaId)
                .HasMaxLength(10)
                .IsUnicode(false)
                .HasColumnName("AREA_ID");
            entity.Property(e => e.DepartmentName)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("DEPARTMENT_NAME");
            entity.Property(e => e.DepartmentType)
                .HasPrecision(1)
                .HasColumnName("DEPARTMENT_TYPE");
        });

        modelBuilder.Entity<AdmCertDeptUser>(entity =>
        {
            entity.HasKey(e => new { e.DepartmentId, e.UserId });

            entity.ToTable("ADM_CERT_DEPT_USERS");

            entity.Property(e => e.DepartmentId)
                .HasPrecision(10)
                .HasColumnName("DEPARTMENT_ID");
            entity.Property(e => e.UserId)
                .HasMaxLength(20)
                .IsUnicode(false)
                .HasColumnName("USER_ID");
        });

        modelBuilder.Entity<OrgUnit>(entity =>
        {
            entity.HasKey(e => e.UnitId).HasName("SYS_C0045395");

            entity.ToTable("ORG_UNITS");

            entity.HasIndex(e => e.ParentId, "IDX_ORG_PARENT");

            entity.Property(e => e.UnitId)
                .ValueGeneratedOnAdd()
                .HasColumnType("NUMBER")
                .HasColumnName("UNIT_ID");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CREATED_BY");
            entity.Property(e => e.CreatedDate)
                .HasDefaultValueSql("SYSDATE")
                .HasColumnType("DATE")
                .HasColumnName("CREATED_DATE");
            entity.Property(e => e.ParentId)
                .HasColumnType("NUMBER")
                .HasColumnName("PARENT_ID");
            entity.Property(e => e.Status)
                .HasPrecision(1)
                .HasDefaultValueSql("1 ")
                .HasColumnName("STATUS");
            entity.Property(e => e.UnitName)
                .HasMaxLength(300)
                .IsUnicode(false)
                .HasColumnName("UNIT_NAME");
            entity.Property(e => e.UnitTypeId)
                .HasColumnType("NUMBER")
                .HasColumnName("UNIT_TYPE_ID");

            entity.HasOne(d => d.UnitType).WithMany(p => p.OrgUnits)
                .HasForeignKey(d => d.UnitTypeId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_UNIT_TYPE");
        });

        modelBuilder.Entity<OrgUnitType>(entity =>
        {
            entity.HasKey(e => e.UnitTypeId).HasName("SYS_C0045390");

            entity.ToTable("ORG_UNIT_TYPES");

            entity.Property(e => e.UnitTypeId)
                .ValueGeneratedOnAdd()
                .HasColumnType("NUMBER")
                .HasColumnName("UNIT_TYPE_ID");
            entity.Property(e => e.CreatedBy)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CREATED_BY");
            entity.Property(e => e.CreatedDate)
                .HasDefaultValueSql("SYSDATE")
                .HasColumnType("DATE")
                .HasColumnName("CREATED_DATE");
            entity.Property(e => e.IsSingleOccupancy)
                .HasPrecision(1)
                .HasDefaultValueSql("0 ")
                .HasColumnName("IS_SINGLE_OCCUPANCY");
            entity.Property(e => e.LeaderTitle)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("LEADER_TITLE");
            entity.Property(e => e.Status)
                .HasPrecision(1)
                .HasDefaultValueSql("1 ")
                .HasColumnName("STATUS");
            entity.Property(e => e.TypeName)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("TYPE_NAME");
        });

        modelBuilder.Entity<UserPosition>(entity =>
        {
            entity.HasKey(e => e.PositionId).HasName("SYS_C0045402");

            entity.ToTable("USER_POSITIONS");

            entity.Property(e => e.PositionId)
                .ValueGeneratedOnAdd()
                .HasColumnType("NUMBER")
                .HasColumnName("POSITION_ID");
            entity.Property(e => e.EndDate)
                .ValueGeneratedOnAdd()
                .HasColumnType("DATE")
                .HasColumnName("END_DATE");
            entity.Property(e => e.IsActive)
                .HasPrecision(1)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("1 ")
                .HasColumnName("IS_ACTIVE");
            entity.Property(e => e.IsManager)
                .HasPrecision(1)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("0\n")
                .HasColumnName("IS_MANAGER");
            entity.Property(e => e.StartDate)
                .ValueGeneratedOnAdd()
                .HasDefaultValueSql("SYSDATE")
                .HasColumnType("DATE")
                .HasColumnName("START_DATE");
            entity.Property(e => e.UnitId)
                .ValueGeneratedOnAdd()
                .HasColumnType("NUMBER")
                .HasColumnName("UNIT_ID");
            entity.Property(e => e.UserId)
                .HasMaxLength(20)
                .IsUnicode(false)
                .ValueGeneratedOnAdd()
                .HasColumnName("USER_ID");

            entity.HasOne(d => d.Unit).WithMany(p => p.UserPositions)
                .HasForeignKey(d => d.UnitId)
                .OnDelete(DeleteBehavior.ClientSetNull)
                .HasConstraintName("FK_POS_UNIT");
        });

        modelBuilder.Entity<VwOrgUnitsWithCount>(entity =>
        {
            entity
                .HasNoKey()
                .ToView("VW_ORG_UNITS_WITH_COUNT");

            entity.Property(e => e.CreatedBy)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("CREATED_BY");
            entity.Property(e => e.CreatedDate)
                .HasColumnType("DATE")
                .HasColumnName("CREATED_DATE");
            entity.Property(e => e.IsSingleOccupancy)
                .HasPrecision(1)
                .HasColumnName("IS_SINGLE_OCCUPANCY");
            entity.Property(e => e.LeaderTitle)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("LEADER_TITLE");
            entity.Property(e => e.OccupancyCount)
                .HasColumnType("NUMBER")
                .HasColumnName("OCCUPANCY_COUNT");
            entity.Property(e => e.ParentId)
                .HasColumnType("NUMBER")
                .HasColumnName("PARENT_ID");
            entity.Property(e => e.ParentTypeId)
                .ValueGeneratedOnAdd()
                .HasColumnType("NUMBER")
                .HasColumnName("PARENT_TYPE_ID");
            entity.Property(e => e.ParentTypeName)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("PARENT_TYPE_NAME");
            entity.Property(e => e.ParentUnitName)
                .HasMaxLength(300)
                .IsUnicode(false)
                .HasColumnName("PARENT_UNIT_NAME");
            entity.Property(e => e.Status)
                .HasPrecision(1)
                .HasColumnName("STATUS");
            entity.Property(e => e.TypeName)
                .HasMaxLength(200)
                .IsUnicode(false)
                .HasColumnName("TYPE_NAME");
            entity.Property(e => e.UnitId)
                .ValueGeneratedOnAdd()
                .HasColumnType("NUMBER")
                .HasColumnName("UNIT_ID");
            entity.Property(e => e.UnitName)
                .HasMaxLength(503)
                .IsUnicode(false)
                .HasColumnName("UNIT_NAME");
        });

        modelBuilder.Entity<PredefinedSqlStatement>(entity =>
        {
            entity.HasKey(e => e.StatementId);

            entity.ToTable("PREDEFINED_SQL_STATEMENTS");

            entity.Property(e => e.StatementId)
                .HasColumnType("NUMBER")
                .HasColumnName("STATEMENT_ID");
            entity.Property(e => e.ApplicationId)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("APPLICATION_ID");
            entity.Property(e => e.SchemaName)
                .HasMaxLength(128)
                .IsUnicode(false)
                .HasColumnName("SCHEMA_NAME");
            entity.Property(e => e.SqlType)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("SQL_TYPE");
            entity.Property(e => e.SqlStatement)
                .HasColumnType("CLOB")
                .HasColumnName("SQL_STATEMENT");
            entity.Property(e => e.Parameters)
                .HasColumnType("CLOB")
                .HasColumnName("PARAMETERS");
            entity.Property(e => e.Description)
                .HasMaxLength(1000)
                .HasColumnName("DESCRIPTION");
            entity.Property(e => e.CreatedAt)
                .HasDefaultValueSql("SYSDATE")
                .HasColumnType("DATE")
                .HasColumnName("CREATED_AT");
            entity.Property(e => e.DatabaseName)
                .HasMaxLength(50)
                .IsUnicode(false)
                .HasColumnName("DATABASE");
        });

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);
}
