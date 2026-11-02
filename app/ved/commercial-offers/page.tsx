import VedSectionIntro from "../VedSectionIntro";
import VedOfferUploadDialog from "./VedOfferUploadDialog";
import VedCommercialOffersList from "./VedCommercialOffersList";
import "./ved-offer-upload.css";

export default function VedCommercialOffersPage(){
 return <VedSectionIntro title="Коммерческие предложения"
   description="Исходные КП, распознанные товары, история расчётов"
   actions={<VedOfferUploadDialog/>}>
   <VedCommercialOffersList/>
 </VedSectionIntro>;
}
