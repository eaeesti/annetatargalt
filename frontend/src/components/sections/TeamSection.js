import Image from "../elements/Image";
import Markdown from "../elements/Markdown";

export default function TeamSection({ title, teamMembers }) {
  return (
    <section className="bg-slate-50 px-4 py-12 pt-24 sm:pb-20 sm:pt-32 lg:px-8">
      <div className="container flex flex-col lg:max-w-3xl">
        <h2 className="inline-block max-w-full break-words text-2xl font-semibold tracking-tight text-primary-700 xs:text-2xl xs:font-bold sm:text-3xl">
          {title}
        </h2>
        <ul role="list" className="flex flex-col divide-y divide-slate-300">
          {teamMembers.map((teamMember) => (
            <li
              key={teamMember.name}
              className="flex flex-col gap-12 py-12 sm:flex-row"
            >
              {/* <Image
                className="aspect-[4/5] w-52 flex-none rounded-2xl object-cover"
                data={teamMember.image}
              /> */}
              <div className="max-w-xl flex-auto">
                <h3 className="text-lg font-semibold leading-8 tracking-tight text-slate-900">
                  {teamMember.name}
                </h3>
                <p className="text-base leading-7 text-slate-600">
                  {teamMember.role}
                </p>
                <Markdown className="prose prose-primary mt-6 w-full">
                  {teamMember.bio}
                </Markdown>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
