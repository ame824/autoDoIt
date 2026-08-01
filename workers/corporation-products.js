import { reportSuccess } from "../core/notifier.js";
import {
  PRODUCT_DIVISION,
  PRODUCT_INDUSTRY,
  getIndustryStartingCost,
  productInvestment,
} from "../lib/corporation-logic.js";

/** @param {NS} ns */
export async function main(ns) {
  const corp = ns.corporation;
  if (!corp.hasCorporation()) return;
  let corporation = corp.getCorporation();
  let divisionName = corporation.divisions.find((name) => {
    try { return corp.getDivision(name).makesProducts; } catch { return false; }
  });
  if (!divisionName) {
    const cost = getIndustryStartingCost(corp.getIndustryData(PRODUCT_INDUSTRY));
    if (corporation.funds < cost * 2) return;
    try {
      corp.expandIndustry(PRODUCT_INDUSTRY, PRODUCT_DIVISION);
      reportSuccess(ns, "corporation-product-division", `${PRODUCT_INDUSTRY}-Division gegründet`);
    } catch { return; }
    return;
  }

  let division = corp.getDivision(divisionName);
  const city = division.cities.includes("Aevum") ? "Aevum" : division.cities[0];
  const products = division.products.map((name) => ({ name, data: corp.getProduct(divisionName, city, name) }));
  if (products.some(({ data }) => data.developmentProgress < 100)) return;
  if (products.length >= division.maxProducts) {
    const weakest = [...products].sort((a, b) => a.data.rating - b.data.rating)[0];
    if (weakest) corp.discontinueProduct(divisionName, weakest.name);
  }

  corporation = corp.getCorporation();
  const profit = Math.max(0, corporation.revenue - corporation.expenses);
  const investment = productInvestment(corporation.funds, profit);
  if (investment < 1e9 || corporation.funds < investment * 2) return;
  division = corp.getDivision(divisionName);
  const productName = `autoDoIt-${Date.now().toString(36)}`;
  corp.makeProduct(divisionName, city, productName, investment, investment);
  reportSuccess(ns, `corporation-product-${productName}`, `Corporation-Produkt gestartet: ${productName}`, [
    `Design/Marketing: ${ns.format.number(investment)} je Bereich.`,
  ]);
}
