import KeywordAnalyticsClient from '../../components/finance/KeywordAnalyticsClient';
import '../../ozon/financier/financier.css';
export const dynamic='force-dynamic';
export default async function KeywordsPage({searchParams}:{searchParams:Promise<{market?:string;article?:string;from?:string;to?:string}>}){
 const p=await searchParams;
 return <KeywordAnalyticsClient market={p.market??'wb'} article={p.article??''} from={p.from??''} to={p.to??''}/>;
}
