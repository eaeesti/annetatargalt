export default function Header() {
  return (
    <div className="flex max-w-xl flex-col space-y-16">
      <div className="text-center">
        <h1 className="mb-4 text-2xl font-bold tracking-tight text-primary-700 md:text-4xl">
          Cik Jūs esat bagāts?
        </h1>
        <p className="md:text-lg">
          Uzziniet, kā Jūsu ienākumi ir salīdzināmi ar citiem pasaules
          iedzīvotājiem.
        </p>
        <p className="md:text-lg">Vai esat starp bagātākajiem?</p>
      </div>
    </div>
  );
}
