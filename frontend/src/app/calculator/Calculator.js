"use client"
import { useState } from "react";
import { defer, scrollSmoothlyTo } from "./utils/utils";
import Header from "./Header";
import IncomeInput from "./IncomeInput";
import Results from "./Results";

export default function Calculator({ evaluations }) {
  let [income, setIncome] = useState();

  function showResults(income) {
    setIncome();
    defer(() => {
      setIncome(income);
      defer(() => scrollSmoothlyTo(document.querySelector("#tulemused")));
    });
  }

  return (
    <div className="flex flex-col items-center px-4 py-24 space-y-20 md:px-8 bg-white text-slate-600">
      <Header />
      <IncomeInput submitIncome={showResults} />
      {!!income && <Results income={income} evaluations={evaluations} />}
    </div>
  );
}
