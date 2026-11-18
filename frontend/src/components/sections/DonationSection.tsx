"use client";

import {
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { at } from "@/utils/object";
import AmountChooser from "../elements/forms/AmountChooser";
import DonationTypeChooser from "../elements/forms/DonationTypeChooser";
import Button from "../elements/Button";
import NameInput from "../elements/forms/NameInput";
import EmailInput from "../elements/forms/EmailInput";
import IdCodeInput from "../elements/forms/IdCodeInput";
import {
  formatAmount,
  formatAmountWithCents,
  withCurrency,
} from "@/utils/money";
import CheckboxInput from "../elements/forms/CheckboxInput";
import { makeDonationRequest } from "@/utils/donation";
import { describeErrorResponse, readStrapiJson } from "@/utils/strapi";
import { useRouter, useSearchParams } from "next/navigation";
import BankChooser from "../elements/forms/BankChooser";
import Markdown from "../elements/Markdown";
import TintedImage from "../elements/TintedImage";
import { format } from "@/utils/string";
import { classes } from "@/utils/react";
import { PencilIcon } from "@heroicons/react/24/outline";
import CauseChooser from "../elements/forms/CauseChooser";
import Proportions from "@/utils/proportions";
import type { ProportionKey } from "@/utils/proportions";
import Modal from "../Modal";
import type { ModalData } from "../Modal";
import CompanyInput from "../elements/forms/CompanyInput";
import { track } from "@/utils/analytics";
import DedicationInput from "../elements/forms/DedicationInput";
import DonationLines from "../elements/forms/DonationLines";
import DonationOverview from "../elements/forms/DonationOverview";
import SummaryBar from "../elements/forms/SummaryBar";
import PaymentMethodChooser from "../elements/forms/PaymentMethodChooser";
import type {
  StrapiDonationSection,
  StrapiGlobal,
  StrapiPage,
} from "@/types/generated/strapi";
import { localeOf } from "@/utils/locale";
import {
  clearDonationDraft,
  donationDraftJson,
  loadDonationDraft,
  parseDonationDraft,
  saveDonationDraft,
} from "@/utils/donation-draft";
import type { DonationState } from "@/utils/donation-draft";
import { splitChoices, supportShare } from "@/utils/donation-amounts";

interface DonationSectionProps extends StrapiDonationSection {
  global: StrapiGlobal;
  page: StrapiPage;
}

/**
 * The donation form. A link can choose one-off giving (?type=onetime) and an
 * organization to give to (?org=). Pages are served from a cache, so the
 * server that renders them never sees a visitor's query string: the cached
 * page has the form with its defaults, which is the fallback here, and the
 * browser replaces it with a form that has the link's choices. On a
 * navigation within the site the query is already known, so the form starts
 * out with them.
 *
 * The browser's form is also the one that keeps a draft (see
 * utils/donation-draft) and picks it up again.
 */
export default function DonationSection(props: DonationSectionProps) {
  return (
    <Suspense
      fallback={
        <DonationForm
          {...props}
          linkType={null}
          linkOrg={null}
          keepsDraft={false}
        />
      }
    >
      <DonationFormForLink {...props} />
    </Suspense>
  );
}

const neverChanges = () => () => {};

/** Wide enough for the checkout to sit beside the form: Tailwind's lg. */
const wideQuery = "(min-width: 64rem)";

/** False on the server and until the page runs: the narrow layout first. */
function useWideScreen() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(wideQuery);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(wideQuery).matches,
    () => false,
  );
}

function DonationFormForLink(props: DonationSectionProps) {
  const searchParams = useSearchParams();
  const linkType = searchParams.get("type");
  const linkOrg = searchParams.get("org");
  // False while React hydrates this form from HTML the server rendered, which
  // can't have the draft kept in the visitor's browser. The form is then made
  // anew, with the draft. (The cached pages have the fallback instead, so
  // there this is true from the start.)
  const inBrowser = useSyncExternalStore(
    neverChanges,
    () => true,
    () => false,
  );

  // a link with other choices starts the form afresh
  return (
    <DonationForm
      key={`${linkType}/${linkOrg}/${inBrowser}`}
      {...props}
      linkType={linkType}
      linkOrg={linkOrg}
      keepsDraft={inBrowser}
    />
  );
}

interface DonationFormProps extends DonationSectionProps {
  linkType: string | null;
  linkOrg: string | null;
  keepsDraft: boolean;
}

function DonationForm({
  linkType,
  linkOrg,
  keepsDraft,
  ...props
}: DonationFormProps) {
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<ModalData>({});

  function showModal(data: ModalData) {
    setModalData(data);
    setModalOpen(true);
  }

  const locale = localeOf(props.global);
  const amounts = [props.amount1, props.amount2, props.amount3];
  const amountOptions = amounts
    .filter((a): a is number => a !== null)
    .map((amount) => ({
      value: amount,
      label: withCurrency(amount, props.global.currency, locale),
    }));
  // In Strapi v5 without v4 compatibility, relations are returned as arrays directly
  // Wrap it to maintain compatibility with components expecting { data: [...] }
  // An inactive organization takes no donations, so the form leaves it out.
  const causes = {
    data: (props.causes || []).map((cause) => ({
      ...cause,
      organizations: cause.organizations.filter(
        (organization) => organization.active,
      ),
    })),
  };

  // Support for the platform is chosen like a cause, its share going to the
  // platform's own organization: what's split is the causes and it.
  const supportOrganization = props.global.tipOrganizationInternalId;
  const choices = splitChoices(causes, supportOrganization);

  const link = `${linkType}/${linkOrg}`;
  // A link that names one of the organizations starts with its cause chosen,
  // all of it going there. Otherwise nothing is chosen to begin with.
  const linksOrganization =
    !!linkOrg &&
    causes.data.some((cause) =>
      cause.organizations.some(
        (organization) => organization.internalId === linkOrg,
      ),
    );

  // A draft names causes by their document id, the same in every language,
  // so switching language keeps the split: a cause's own id differs between
  // languages. (Organizations are named by their internal id, which doesn't.)
  const documentIdOf = new Map<ProportionKey, ProportionKey>(
    causes.data.map((cause) => [cause.id, cause.documentId]),
  );
  const idOf = new Map<ProportionKey, ProportionKey>(
    causes.data.map((cause) => [cause.documentId, cause.id]),
  );
  const toKept = (proportions: Proportions) =>
    proportions.renameKeys((key) => documentIdOf.get(key) ?? key);
  const fromKept = (proportions: Proportions) =>
    proportions.renameKeys((key) => idOf.get(key) ?? key);

  // The form as the visitor left it in this tab, or as the link chooses it.
  const [initial] = useState(() => {
    const donation: DonationState = {
      amount: amountOptions[1]?.value ?? amountOptions[0]?.value ?? 0,
      type: linkType === "onetime" ? "onetime" : "recurring",
      firstName: "",
      lastName: "",
      email: "",
      idCode: "",
      bank: "",
      companyDonation: false,
      companyName: "",
      companyCode: "",
      dedicateDonation: false,
      dedicationName: "",
      dedicationEmail: "",
      dedicationMessage: "",
      proportions: linksOrganization
        ? Proportions.fromStrapiData(choices.data, linkOrg ?? undefined)
        : Proportions.fromStrapiDataNoneChosen(choices.data),
      paymentMethod: "paymentInitiation",
      newsletter: true,
      acceptTerms: false,
    };
    const draft = keepsDraft
      ? parseDonationDraft(loadDonationDraft(), link, {
          proportions: toKept(donation.proportions),
          banks: props.banks.map(({ bank }) => bank),
        })
      : null;
    return draft
      ? {
          ...draft,
          donation: {
            ...draft.donation,
            proportions: fromKept(draft.donation.proportions),
          },
        }
      : { stage: 0, donation };
  });
  const [donation, setDonation] = useState(initial.donation);

  const [validity, setValidity] = useState<Record<string, boolean>>({});
  const stageValidity: Record<number, boolean> = {
    // a cause or support chosen
    0:
      at(validity, ["amount"]).every(Boolean) &&
      donation.proportions.chosenKeys().length > 0,
    // The dedication only counts for a one-off donation, the only kind that
    // shows it: one left half-filled before switching to monthly doesn't block.
    1: at(validity, [
      "firstName",
      "lastName",
      "email",
      "idCode",
      "company",
      ...(donation.type === "onetime" ? ["dedication"] : []),
    ]).every(Boolean),
    2:
      donation.acceptTerms &&
      (donation.type === "recurring" ? !!donation.bank : true),
  };
  // Donate is on the details step, so it waits for all of it.
  const canDonate = stageValidity[0] && stageValidity[1] && stageValidity[2];

  // Two steps: the amount and where it goes, then details and paying. (A
  // draft from when there were more steps picks up on the last.)
  const lastStage = 1;
  const [stage, setStage] = useState(Math.min(initial.stage, lastStage));
  // Details are laid out differently on narrow screens: one column, the
  // donation in a summary bar at the top.
  const wide = useWideScreen();
  const [donated, setDonated] = useState(false);

  // Kept as the visitor goes, but only once they change something: just
  // opening another link's form leaves the draft of the one they filled in.
  const keptDraft = useRef<string | null>(null);
  const draftJson = donationDraftJson(link, stage, {
    ...donation,
    proportions: toKept(donation.proportions),
  });
  useEffect(() => {
    if (!keepsDraft) return;
    if (keptDraft.current !== null && draftJson !== keptDraft.current) {
      saveDonationDraft(draftJson);
    }
    keptDraft.current = draftJson;
  }, [keepsDraft, draftJson]);

  // A new step starts at the top of the form: on a phone, Next is far down.
  const sectionRef = useRef<HTMLElement>(null);
  const scrolledStage = useRef(stage);
  useEffect(() => {
    if (scrolledStage.current === stage) return;
    scrolledStage.current = stage;
    sectionRef.current?.scrollIntoView({ block: "start" });
  }, [stage]);
  const paymentTitleId = useId();

  const money = (amount: number) =>
    withCurrency(
      formatAmountWithCents(amount, locale),
      props.global.currency,
      locale,
    );

  const donate = async () => {
    const donationData: Record<string, unknown> = {
      type: donation.type,
      firstName: donation.firstName,
      lastName: donation.lastName,
      email: donation.email,
      idCode: donation.idCode,
      bank: donation.bank,
      paymentMethod: donation.paymentMethod,
      // Only a choice the donor saw: a hidden box would turn the newsletter
      // back on for a returning donor who had turned it off.
      newsletter: props.newsletterText ? donation.newsletter : undefined,
      // Picks the language of the payment page, the thank-you page and emails.
      locale,
    };
    // Support comes out of the amount, as one of its lines: the total is the
    // amount chosen.
    donationData.amounts = donation.proportions
      .calculateAmounts(donation.amount, choices)
      .map(({ organizationInternalId, amount }) => ({
        organizationInternalId,
        amount: Math.round(amount * 100),
      }));
    donationData.amount = Math.round(donation.amount * 100);
    if (donation.companyDonation) {
      donationData.companyName = donation.companyName;
      donationData.companyCode = donation.companyCode;
    }
    if (donation.dedicateDonation && donation.type === "onetime") {
      donationData.dedicationName = donation.dedicationName;
      donationData.dedicationEmail = donation.dedicationEmail;
      donationData.dedicationMessage = donation.dedicationMessage;
    }

    const showError = (reason: "network" | "server", description: string) => {
      track("donation:failed", { type: donation.type, reason });
      showModal({
        icon: "error",
        title: props.global.errorText ?? "Error",
        description,
      });
    };

    let response;
    try {
      response = await makeDonationRequest(donationData);
    } catch (error) {
      // Offline, or the request never got an answer.
      showError("network", String(error));
      return;
    }

    if (!response.ok) {
      showError("server", await describeErrorResponse(response));
      return;
    }

    const data = await readStrapiJson<{ redirectURL: string }>(response);
    if (data.redirectURL) {
      // the draft stays until the thank-you page, in case the payment
      // doesn't go through
      router.push(data.redirectURL);
    } else {
      // monthly: the donation is saved and the donor gets the standing
      // order's details
      track("recurring-donation:created", { amount: donation.amount });
      clearDonationDraft();
      setDonated(true);
    }
  };

  function trackSubmitted() {
    const onetime = donation.type === "onetime";
    track("donation:submitted", {
      type: donation.type,
      amount: donation.amount,
      tip_percent: supportShare(donation.proportions),
      payment_method: onetime
        ? donation.paymentMethod === "cardPayments"
          ? "card"
          : "bank"
        : undefined,
      company: donation.companyDonation,
      dedication: onetime && donation.dedicateDonation,
      from_link: linkType !== null || linkOrg !== null,
    });
  }

  const total = money(donation.amount);
  const typeText =
    donation.type === "recurring"
      ? props.recurringDonationText
      : props.singleDonationText;

  // Paying: the bank (monthly) or payment method (one-off), the newsletter,
  // the terms and Donate. On narrow screens Donate also says the total, as
  // the summary bar with it is a long way up by then.
  const payment = (withTotal: boolean) => (
    <>
      {donation.type === "recurring" && (
        <BankChooser
          bankText={props.bankText}
          otherBankText={props.otherBankText}
          banks={props.banks}
          bank={donation.bank}
          setBank={(bank) => setDonation({ ...donation, bank })}
        />
      )}
      {donation.type === "onetime" && (
        <PaymentMethodChooser
          paymentMethod={donation.paymentMethod}
          setPaymentMethod={(paymentMethod) =>
            setDonation({ ...donation, paymentMethod })
          }
          label={props.paymentMethodText}
          paymentInitiationText={props.paymentInitiationText}
          cardPaymentsText={props.cardPaymentsText}
        />
      )}
      {props.newsletterText && (
        <CheckboxInput
          name="newsletter"
          label={props.newsletterText}
          value={donation.newsletter}
          setValue={(newsletter) => setDonation({ ...donation, newsletter })}
        />
      )}
      <CheckboxInput
        name="terms"
        label={props.termsText}
        value={donation.acceptTerms}
        setValue={(acceptTerms) => setDonation({ ...donation, acceptTerms })}
      />
      <Button
        text={
          withTotal
            ? `${props.donateButtonText ?? ""} ${total}`
            : props.donateButtonText
        }
        type="primary"
        size="lg"
        onClick={() => {
          trackSubmitted();
          donate();
        }}
        disabled={!canDonate}
        buttonType="button"
        className="mt-2"
      />
      {donation.type === "onetime" &&
        (props.paymentProviderText || props.paymentProviderLogo?.file) && (
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            {props.paymentProviderText && (
              <p className="text-sm text-slate-500">
                {props.paymentProviderText}
              </p>
            )}
            {props.paymentProviderLogo?.file && (
              <TintedImage
                data={props.paymentProviderLogo}
                className="h-4 bg-slate-400"
              />
            )}
          </div>
        )}
    </>
  );

  const lines = (className?: string) => (
    <DonationLines
      amount={donation.amount}
      proportions={donation.proportions}
      causes={causes}
      supportOrganization={supportOrganization}
      supportTitle={props.supportOptionText}
      money={money}
      emptyText={props.chooseCauseText}
      className={className}
    />
  );

  const totalLine = (
    <div className="flex items-baseline justify-between gap-3">
      <span className="font-semibold text-slate-900">
        {props.global.totalText}
      </span>
      <span className="text-2xl font-bold tracking-tight whitespace-nowrap text-primary-700">
        {total}
      </span>
    </div>
  );

  // On to the details: until a cause is chosen, disabled, with what's
  // missing said under it.
  const next = (
    <div className="mt-2 flex flex-col gap-2">
      <Button
        text={props.nextButtonText}
        type="primary"
        size="lg"
        onClick={() => {
          track("donation-form:step-opened", {
            step: "info",
            type: donation.type,
          });
          setStage(1);
        }}
        disabled={!stageValidity[0]}
        buttonType="button"
      />
      {donation.proportions.chosenKeys().length === 0 && (
        <p className="text-center text-sm text-slate-500">
          {props.chooseCauseText}
        </p>
      )}
    </div>
  );

  // Back from the details to the amount and causes.
  const editDonation = (
    <button
      type="button"
      onClick={() => setStage(0)}
      className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 self-start rounded-full border border-slate-400 bg-white px-3 py-1 text-[13px] font-semibold text-primary-700 hover:bg-primary-50"
    >
      <PencilIcon className="h-3.5 w-3.5" aria-hidden={true} />
      {props.editDonationText}
    </button>
  );

  // On narrow screens the names share a row, and the summary bar heads the
  // step: the heading is there for screen readers only.
  const detailsFields = (narrow: boolean) => (
    <>
      <h2
        className={
          narrow
            ? "sr-only"
            : "text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl"
        }
      >
        {props.detailsText}
      </h2>
      <NameInput
        firstNameText={props.firstNameText}
        lastNameText={props.lastNameText}
        firstName={donation.firstName}
        lastName={donation.lastName}
        setFirstName={(firstName) => setDonation({ ...donation, firstName })}
        setLastName={(lastName) => setDonation({ ...donation, lastName })}
        setValidity={setValidity}
        sideBySide={narrow}
        // The step starts with the donation above the fields: a cursor in
        // them would scroll past it and, on a phone, open the keyboard.
        autoFocus={false}
      />
      <EmailInput
        emailText={props.emailText}
        email={donation.email}
        setEmail={(email) => setDonation({ ...donation, email })}
        setValidity={setValidity}
      />
      <IdCodeInput
        idCodeText={props.idCodeText}
        idCodeDescription={props.idCodeDescription}
        idCode={donation.idCode}
        setIdCode={(idCode) => setDonation({ ...donation, idCode })}
        setValidity={setValidity}
      />
      <CompanyInput
        donateAsCompanyText={props.donateAsCompanyText}
        companyDonation={donation.companyDonation}
        setCompanyDonation={(companyDonation) =>
          setDonation({ ...donation, companyDonation })
        }
        companyNameText={props.companyNameText}
        companyName={donation.companyName}
        setCompanyName={(companyName) =>
          setDonation({ ...donation, companyName })
        }
        companyCodeText={props.companyCodeText}
        companyCode={donation.companyCode}
        setCompanyCode={(companyCode) =>
          setDonation({ ...donation, companyCode })
        }
        setValidity={setValidity}
      />
      {donation.type === "onetime" && (
        <DedicationInput
          dedicateDonationText={props.dedicateDonationText}
          dedicateDonation={donation.dedicateDonation}
          setDedicateDonation={(dedicateDonation) =>
            setDonation({ ...donation, dedicateDonation })
          }
          dedicationNameText={props.dedicationNameText}
          dedicationName={donation.dedicationName}
          setDedicationName={(dedicationName) =>
            setDonation({ ...donation, dedicationName })
          }
          dedicationEmailText={props.dedicationEmailText}
          dedicationEmail={donation.dedicationEmail}
          setDedicationEmail={(dedicationEmail) =>
            setDonation({ ...donation, dedicationEmail })
          }
          dedicationMessageText={props.dedicationMessageText}
          dedicationMessage={donation.dedicationMessage}
          setDedicationMessage={(dedicationMessage) =>
            setDonation({ ...donation, dedicationMessage })
          }
          setValidity={setValidity}
        />
      )}
    </>
  );

  // The form, on the page's own background: no card around it.
  const formClasses = "flex w-full flex-col gap-4";

  return (
    <section
      ref={sectionRef}
      className="flex h-full grow scroll-mt-24 items-start justify-center bg-white px-4 pt-6 pb-24 sm:px-8 sm:pt-16 sm:pb-32 lg:items-stretch lg:py-0"
    >
      <h1 className="sr-only">{props.page.metadata?.title}</h1>
      {!donated && stage === 0 && (
        <div className="flex w-full max-w-lg flex-col gap-8 lg:grid lg:max-w-5xl lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
          <form
            className={classes(formClasses, "lg:pt-16 lg:pb-32")}
            onSubmit={(event) => event.preventDefault()}
          >
            <h2 className="text-2xl font-bold tracking-tight text-primary-700 sm:text-3xl">
              {props.title}
            </h2>
            <DonationTypeChooser
              donationType={donation.type}
              setDonationType={(type) => setDonation({ ...donation, type })}
              label={props.donationTypeText}
              recurringDonationText={props.recurringDonationText}
              singleDonationText={props.singleDonationText}
            />
            <AmountChooser
              amount={donation.amount}
              setAmount={(amount) => setDonation({ ...donation, amount })}
              amountText={props.amountText}
              amountOptions={amountOptions}
              otherAmountText={props.otherAmountText}
              otherAmountOptionText={props.otherAmountOptionText}
              currency={props.global.currency}
              setValidity={setValidity}
            />
            <CauseChooser
              causes={causes}
              supportOrganization={supportOrganization}
              proportions={donation.proportions}
              setProportions={(proportions) =>
                setDonation({ ...donation, proportions })
              }
              amount={donation.amount}
              money={money}
              texts={{
                legend: props.chooseOrganizationsText,
                hint: props.causesHintText,
                notChosen: props.notChosenText,
                support: props.supportOptionText,
                supportDescription: props.supportOptionDescription,
                specifyCharities: props.specifyCharitiesText,
                editCharities: props.editCharitiesText,
                adjustSplit: props.adjustSplitText,
                splitEvenly: props.splitEvenlyText,
                resetSplit: props.resetSplitText,
                splitHint: props.splitHintText,
                title: props.charitiesTitle,
                text: props.charitiesText,
                chooseCharity: props.chooseCharityText,
                confirm: props.charitiesConfirmText,
                cancel: props.charitiesCancelText,
                close: props.global.closeText,
                learnMore: props.learnMoreText,
                recommended: props.recommendedText,
              }}
              locale={locale}
            />
            {/* Narrow screens: the total and Next end the form. Wide ones
                have them in the summary beside it. */}
            <div className="mt-2 flex flex-col gap-4 lg:hidden">
              {totalLine}
              {next}
            </div>
          </form>
          {/* A line down the side of the form, from the header to the
              footer: on wide screens the section has no space above and
              below, the columns do. The summary keeps in view as the form
              scrolls past. */}
          <div className="hidden lg:block lg:border-l lg:border-slate-300 lg:pt-16 lg:pb-32 lg:pl-12">
            <div className="lg:sticky lg:top-24">
              <DonationOverview
                title={props.overviewTitle}
                typeText={typeText}
                lines={lines("border-y border-slate-200")}
                totalText={props.global.totalText}
                total={total}
              >
                {next}
              </DonationOverview>
            </div>
          </div>
        </div>
      )}
      {!donated && stage === 1 && wide && (
        <div className="grid w-full max-w-5xl grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-12">
          <form
            className={classes(formClasses, "pt-16 pb-32")}
            onSubmit={(event) => event.preventDefault()}
          >
            {detailsFields(false)}
          </form>
          <div className="border-l border-slate-300 pt-16 pb-32 pl-12">
            <DonationOverview
              title={props.overviewTitle}
              typeText={typeText}
              lines={lines("border-y border-slate-200")}
              edit={editDonation}
              totalText={props.global.totalText}
              total={total}
            >
              <div className="mt-2 flex flex-col gap-5 border-t border-slate-200 pt-6">
                {payment(false)}
              </div>
            </DonationOverview>
          </div>
        </div>
      )}
      {!donated && stage === 1 && !wide && (
        <form
          className={classes(formClasses, "max-w-lg")}
          onSubmit={(event) => event.preventDefault()}
        >
          <SummaryBar
            title={props.overviewTitle}
            typeText={typeText}
            total={total}
          >
            {lines()}
          </SummaryBar>
          <div className="-mt-1 flex">{editDonation}</div>
          <div className="flex flex-col gap-4">{detailsFields(true)}</div>
          <section
            aria-labelledby={paymentTitleId}
            className="mt-2 flex flex-col gap-5 border-t border-slate-200 pt-6"
          >
            <h3
              id={paymentTitleId}
              className="text-xl leading-6 font-semibold tracking-tight text-primary-700"
            >
              {props.paymentTitle}
            </h3>
            {payment(true)}
          </section>
        </form>
      )}
      {donated && (
        <div className="flex max-w-lg flex-col gap-4 lg:pt-16 lg:pb-32">
          <Markdown className="prose w-full prose-primary">
            {format(props.recurringDonationGuide ?? "", {
              amount: withCurrency(
                formatAmount(donation.amount, locale),
                props.global.currency,
                locale,
              ),
            })}
          </Markdown>
        </div>
      )}
      <Modal
        open={modalOpen}
        data={modalData}
        setOpen={setModalOpen}
        closeText={props.global.closeText ?? ""}
      />
    </section>
  );
}
