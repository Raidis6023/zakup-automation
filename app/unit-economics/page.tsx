import PageHeader from "../ui/PageHeader";
import UnitEconomicsVersions from "./UnitEconomicsVersions";
import "./unit-economics.css";
import "./unit-economics-pilot.css";
export default function UnitEconomicsPage(){
 return <main className="unit-page workspace-ui">
  <PageHeader title="Юнит-экономика" description="Предварительный расчёт закупок по Ozon, Wildberries и Яндекс Маркету."/>
  <UnitEconomicsVersions/>
 </main>;
}