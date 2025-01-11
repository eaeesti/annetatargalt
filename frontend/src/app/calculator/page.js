import { getGlobal } from "../../utils/strapi";
import Calculator from "./Calculator";
import { fetchEvaluations } from "./utils/impact";

export default async function CalculatorPage() {
  const evaluations = await fetchEvaluations();

  return <Calculator evaluations={evaluations} />;
}
