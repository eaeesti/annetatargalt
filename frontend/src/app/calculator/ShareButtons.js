import {
  FacebookShareButton,
  LinkedInShareButton,
  TwitterShareButton,
} from "./buttons";

export default function ShareButtons() {
  const url = "https://kuirikassaoled.annetatargalt.ee";

  return (
    <div className="flex flex-col items-center space-y-8 w-full text-center">
      <h2 className="text-xl">Jaga lehekülge teistega!</h2>
      <div className="flex flex-col space-y-4 md:space-y-0 md:flex-row md:space-x-4">
        <FacebookShareButton buttonText="Jagan Facebookis" url={url} />
        <TwitterShareButton
          buttonText="Jagan Twitteris"
          tweet="Kuidas sinu sissetulek võrdleb maailma elanikega?"
          hashtags={["annetatargalt", "kuirikassaoled"]}
          url={url}
        />
        <LinkedInShareButton buttonText="Jagan LinkedInis" url={url} />
      </div>
    </div>
  );
}
