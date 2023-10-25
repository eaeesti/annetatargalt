import TextSection from "./TextSection";

export default function EntityTextSection({ field, entity }) {
  const text = entity[field];
  return <TextSection text={text} />;
}
