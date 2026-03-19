using AutoMapper;
using Models.Attachment;
using Models.Correspondance;
using Models.DTO;
using Models.DTO.Correspondance;
using Models.DTO.Correspondance.AdminCertificates;
using Models.DTO.Correspondance.Replies;

namespace Models.AutoMapping
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            CreateMap<CdcategoryDto, Cdcategory>().ReverseMap();
            CreateMap<CdCategoryMandDto, CdCategoryMand>().ReverseMap();
            CreateMap<CdmendDto, Cdmend>().ReverseMap();
            CreateMap<MessageRequest, Message>().ReverseMap();
            CreateMap<MessageDto, Message>().ReverseMap();
            CreateMap<MessagesAllDto, Message>().ReverseMap();
            CreateMap<AttchShipment, AttchShipmentDto>().ReverseMap();
            CreateMap<Reply, ReplyDto>().ReverseMap();
        }
    }
}
