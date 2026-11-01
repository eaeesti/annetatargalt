import { describe, it, expect } from "vitest";
import {
  fillIn,
  imagesIn,
  isWholeYear,
  lint,
  parseAddresses,
  parseAudience,
  parseContent,
  renderEmail,
  type CampaignContent,
  type Recipient,
  type RenderContext,
} from "../email-campaign";

// The media library's Cloudinary account, as the tests' pictures have it
process.env.CLOUDINARY_NAME = "demo";

const mari: Recipient = {
  donorId: 1,
  email: "mari@example.com",
  firstName: "Mari",
  lastName: "Maasikas",
  idCode: "49001010000",
  locale: "et",
  recurring: true,
};

function content(changes: Partial<CampaignContent> = {}): CampaignContent {
  return {
    subject: { et: "Tere, {{firstName}}", en: "Hello, {{firstName}}" },
    blocks: [{ id: "1", traits: {}, text: { et: "Tere!", en: "Hello!" } }],
    ...changes,
  };
}

const errors = (issues: { severity: string }[]) =>
  issues.filter((issue) => issue.severity === "error");

describe("parseContent", () => {
  it("reads an email from the editor", () => {
    expect(parseContent(content())).toEqual(content());
  });

  it("keeps only the traits there are", () => {
    expect(
      parseContent({
        subject: {},
        blocks: [
          { id: "1", traits: { rich: true, recurring: false }, text: {} },
        ],
      })?.blocks[0]?.traits,
    ).toEqual({ recurring: false });
  });

  it("refuses a block without an id", () => {
    expect(parseContent({ blocks: [{ traits: {} }] })).toBeNull();
  });

  it("reads missing texts as empty", () => {
    expect(parseContent({ blocks: [{ id: "1" }] })).toEqual({
      subject: { et: "", en: "" },
      blocks: [{ id: "1", traits: {}, text: { et: "", en: "" } }],
    });
  });
});

describe("parseAudience", () => {
  it("keeps only the filters there are", () => {
    expect(
      parseAudience({ locale: "en", recurring: false, hasIdCode: "yes", x: 1 }),
    ).toEqual({ locale: "en", recurring: false });
  });

  it("keeps a period of real days, in order", () => {
    const period = { from: "2026-01-01", to: "2026-12-31" };
    expect(parseAudience({ period })).toEqual({ period });
    expect(
      parseAudience({ period: { from: "2026-12-31", to: "2026-01-01" } }),
    ).toEqual({});
    expect(
      parseAudience({ period: { from: "last year", to: "2026-01-01" } }),
    ).toEqual({});
    // A day that doesn't exist would run into the next month.
    expect(
      parseAudience({ period: { from: "2026-02-01", to: "2026-02-31" } }),
    ).toEqual({});
    expect(
      parseAudience({ period: { from: "2028-02-01", to: "2028-02-29" } }),
    ).toEqual({ period: { from: "2028-02-01", to: "2028-02-29" } });
  });

  it("keeps the addresses typed in", () => {
    expect(
      parseAudience({
        emails: " Mari@Example.org,\njuku@example.org mari@example.org",
      }),
    ).toEqual({ emails: ["mari@example.org", "juku@example.org"] });
    expect(parseAudience({ emails: "  " })).toEqual({});
    // Typed, but no address in it: kept, to be shown again and checked
    expect(parseAudience({ emails: "Mari, " })).toEqual({ emails: ["mari"] });
    // Nothing but separators, as an empty box
    expect(parseAudience({ emails: ", ;\n" })).toEqual({});
    expect(parseAudience({ emails: [] })).toEqual({});
  });
});

describe("parseAddresses", () => {
  it("reads a list as well as text", () => {
    expect(parseAddresses(["A@b.ee", " ", 3])).toEqual(["a@b.ee"]);
  });
});

describe("fillIn", () => {
  it("puts in the donor's values", () => {
    expect(fillIn("Hea {{ firstName }} {{lastName}}", mari)).toBe(
      "Hea Mari Maasikas",
    );
  });

  it("leaves a missing value empty", () => {
    expect(fillIn("Hea {{firstName}}!", { ...mari, firstName: null })).toBe(
      "Hea !",
    );
  });
});

describe("a donor's value in the email", () => {
  const shown = (text: string, firstName: string) =>
    renderEmail(
      content({
        blocks: [{ id: "1", traits: {}, text: { et: text, en: "" } }],
      }),
      { ...mari, firstName },
    );

  it("is never read as Markdown", () => {
    expect(shown("{{firstName}}", "*Mari_Liis*").html).toBe(
      "<p>*Mari_Liis*</p>\n",
    );
    expect(shown("Tere {{firstName}}", "# Mari").html).toBe(
      "<p>Tere # Mari</p>\n",
    );
  });

  it("is text in HTML the team wrote, with nothing added", () => {
    const html = shown(
      "<p>Tere {{firstName}}</p>",
      '<a href="https://example.org">Mari</a> & co',
    ).html;
    expect(html).not.toContain("<a ");
    expect(html).toContain("&lt;a href=&quot;https://example.org&quot;&gt;");
    expect(shown("<p>{{firstName}}</p>", "Mari-Liis").html).toBe(
      "<p>Mari-Liis</p>",
    );
    expect(shown("{{firstName}}", "O'Brien").html).toBe(
      "<p>O&#039;Brien</p>\n",
    );
  });

  it("shows as it is in a picture's description and in code", () => {
    expect(
      shown(
        "![{{firstName}}](https://res.cloudinary.com/x/image/upload/a.png)",
        "Mari-Liis",
      ).html,
    ).toContain('alt="Mari-Liis"');
    expect(shown("`{{firstName}}`", "Mari-Liis").html).toBe(
      "<p><code>Mari-Liis</code></p>\n",
    );
  });

  it("is as it is in the plain text", () => {
    const name = '<b>Mari</b> & "co"';
    expect(shown("{{firstName}}", name).text).toBe(name);
  });
});

describe("renderEmail", () => {
  const blocks: CampaignContent["blocks"] = [
    { id: "1", traits: {}, text: { et: "Kõigile", en: "To all" } },
    { id: "2", traits: { recurring: true }, text: { et: "Püsi", en: "" } },
    {
      id: "3",
      traits: { hasIdCode: false },
      text: { et: "Isikukood", en: "ID" },
    },
  ];

  it("has the blocks the donor is in", () => {
    const email = renderEmail(content({ blocks }), mari);
    expect(email.subject).toBe("Tere, Mari");
    expect(email.text).toBe("Kõigile\n\nPüsi");
    expect(email.html).toBe("<p>Kõigile</p>\n<p>Püsi</p>\n");
  });

  it("is in the donor's language, or Estonian where there's no English", () => {
    const email = renderEmail(content({ blocks }), {
      ...mari,
      locale: "en",
      idCode: null,
    });
    expect(email.subject).toBe("Hello, Mari");
    expect(email.text).toBe("To all\n\nPüsi\n\nID");
  });
});

describe("lint", () => {
  it("finds nothing wrong with a whole email", () => {
    expect(lint(content(), "newsletter", [mari])).toEqual([]);
  });

  it("stops a variable there isn't", () => {
    const issues = lint(
      content({
        blocks: [{ id: "1", traits: {}, text: { et: "{{total}}", en: "x" } }],
      }),
      "newsletter",
      [mari],
    );
    expect(errors(issues)).toHaveLength(1);
    expect(issues[0]?.message).toContain("{{total}}");
    expect(issues[0]?.message).toContain("block 1 (Estonian)");
  });

  it("stops a variable that isn't whole", () => {
    const issues = lint(
      content({ subject: { et: "Tere {{firstName", en: "x" } }),
      "newsletter",
      [mari],
    );
    expect(errors(issues)).toHaveLength(1);
  });

  it("stops an email with no subject or text", () => {
    const issues = lint(
      content({
        subject: { et: "", en: "" },
        blocks: [{ id: "1", traits: {}, text: { et: " ", en: "" } }],
      }),
      "newsletter",
      [mari],
    );
    expect(errors(issues)).toHaveLength(2);
  });

  it("warns when English donors would get Estonian text", () => {
    const issues = lint(
      content({ subject: { et: "Tere", en: "" } }),
      "newsletter",
      [mari, { ...mari, donorId: 2, locale: "en" }],
    );
    expect(issues).toEqual([
      {
        severity: "warning",
        message:
          "1 donor gets emails in English, but the subject has no English text: they'll get the Estonian.",
      },
    ]);
  });

  it("counts the donors a variable would be empty for", () => {
    const issues = lint(content(), "newsletter", [
      mari,
      { ...mari, donorId: 2, firstName: null },
      { ...mari, donorId: 3, firstName: " " },
    ]);
    expect(issues).toEqual([
      {
        severity: "warning",
        message:
          "2 donors who get {{firstName}} have no first name: it will be left empty for them.",
      },
    ]);
  });
});

describe("a summary of what a donor gave", () => {
  const context: RenderContext = {
    organization: (internalId, locale) =>
      ({
        amf: {
          title: "Bednet Fund",
          cause: locale === "en" ? "Human wellbeing" : "Inimeste heaolu",
        },
        thl: {
          title: "Hen Welfare League",
          cause: locale === "en" ? "Animal welfare" : "Loomade heaolu",
        },
        wai: {
          title: "Field_Mouse Project",
          cause: locale === "en" ? "Animal welfare" : "Loomade heaolu",
        },
        at: { title: "Anneta Targalt", cause: null },
      })[internalId] ?? null,
    supportOrganization: "at",
    taxRate: 22,
    pictureWidth: () => null,
  };
  const giver: Recipient = {
    ...mari,
    gifts: {
      count: 5,
      byOrganization: [
        { internalId: "thl", cents: 10_000 },
        { internalId: "amf", cents: 20_000 },
        { internalId: "wai", cents: 10_050 },
        { internalId: "at", cents: 2_000 },
      ],
      companyCents: 12_000,
    },
  };
  const period = { from: "2026-01-01", to: "2026-12-31" };
  const say = (text: string, recipient = giver) =>
    fillIn(text, recipient, context);

  it("counts and adds up the donations", () => {
    expect(
      say("{{donationCount}}, {{total}}, {{support}}, {{companyTotal}}"),
    ).toBe("5, 420,50€, 20€, 120€");
    expect(say("{{total}}", { ...giver, locale: "en" })).toBe("€420.50");
  });

  it("lists the organizations, largest first, without the support", () => {
    expect(say("{{organizations}}")).toBe(
      "Bednet Fund: 200€\nField_Mouse Project: 100,50€\nHen Welfare League: 100€",
    );
    const html = renderEmail(
      content({
        blocks: [
          {
            id: "1",
            traits: {},
            text: { et: "Jaotus:{{organizations}}Aitäh!", en: "" },
          },
        ],
      }),
      giver,
      context,
    ).html;
    expect(html).toContain(
      "<ul>\n<li>Bednet Fund: 200€</li>\n<li>Field_Mouse Project: 100,50€</li>\n<li>Hen Welfare League: 100€</li>\n</ul>",
    );
  });

  it("gives each cause's share in whole percents that add up", () => {
    expect(say("{{causes}}")).toBe("50% loomade heaolu ja 50% inimeste heaolu");
    expect(say("{{causes}}", { ...giver, locale: "en" })).toBe(
      "50% animal welfare and 50% human wellbeing",
    );
  });

  it("writes an Estonian text's amounts and causes in Estonian, for an English reader too", () => {
    const email = renderEmail(
      content({
        subject: { et: "Kokku {{total}}", en: "" },
        blocks: [
          {
            id: "1",
            traits: {},
            text: { et: "Andsid {{total}}: {{causes}}.", en: "" },
          },
          {
            id: "2",
            traits: {},
            text: { et: "Aitäh!", en: "You gave **{{total}}**." },
          },
        ],
      }),
      { ...giver, locale: "en" },
      context,
    );
    expect(email.subject).toBe("Kokku 420,50€");
    expect(email.text).toBe(
      "Andsid 420,50€: 50% loomade heaolu ja 50% inimeste heaolu.\n\nYou gave **€420.50**.",
    );
    expect(email.html).toContain(
      "<p>Andsid 420,50€: 50% loomade heaolu ja 50% inimeste heaolu.</p>",
    );
    expect(email.html).toContain("<strong>€420.50</strong>");
  });

  it("works out the tax room from their own donations only", () => {
    // 420,50 given, 120 of it through a company: 300,50 counts.
    expect(say("{{taxRoom}} → {{taxRefund}}")).toBe("899,50€ → 197,89€");
  });

  it("has the tax room only for one whole year, which the limit is for", () => {
    const room = content({
      blocks: [
        {
          id: "1",
          traits: { underTaxLimit: true },
          text: { et: "Alles: {{taxRoom}}", en: "Left: {{taxRoom}}" },
        },
        { id: "2", traits: {}, text: { et: "Aitäh!", en: "Thank you!" } },
      ],
    });
    const check = (period: { from: string; to: string }) =>
      errors(lint(room, "yearly", [giver], { period }, context)).map(
        (issue) => issue.message,
      );
    expect(check(period)).toEqual([]);
    const twoYears = check({ from: "2025-01-01", to: "2026-12-31" });
    expect(twoYears).toHaveLength(3);
    expect(twoYears[0]).toContain("one whole year");
    expect(check({ from: "2026-01-01", to: "2026-06-30" })).toHaveLength(3);
    expect(isWholeYear({ from: "2025-01-01", to: "2025-12-31" })).toBe(true);
    expect(isWholeYear({ from: "2025-01-01", to: "2026-12-31" })).toBe(false);
    expect(isWholeYear(undefined)).toBe(false);
  });

  it("warns about an organization the site has no more", () => {
    const gone: Recipient = {
      ...giver,
      gifts: {
        count: 2,
        byOrganization: [
          { internalId: "amf", cents: 1000 },
          { internalId: "closed", cents: 500 },
        ],
        companyCents: 0,
      },
    };
    const summary = content({
      blocks: [
        {
          id: "1",
          traits: {},
          text: { et: "{{organizations}}", en: "{{organizations}}" },
        },
      ],
    });
    expect(
      lint(summary, "yearly", [gone], { period }, context)
        .filter((issue) => issue.message.includes("closed"))
        .map((issue) => issue.message),
    ).toEqual([
      "1 donor gave to closed, which the site has no organization for any more: {{organizations}} shows its internal ID, and {{causes}} leaves it out. Adding it back, even as a draft, gives it its name.",
    ]);
    expect(lint(summary, "yearly", [giver], { period }, context)).toEqual([]);
  });

  it("keeps a list out of the subject", () => {
    const listed = content({
      subject: { et: "Sinu {{organizations}}", en: "" },
    });
    expect(
      errors(lint(listed, "yearly", [giver], { period }, context)).map(
        (issue) => issue.message,
      ),
    ).toEqual([
      "{{organizations}} in the Estonian subject is a list, which a subject can't have: put it in a block.",
    ]);
    // And a subject is one line, whatever's in it
    expect(renderEmail(listed, giver, context).subject).toBe(
      "Sinu Bednet Fund: 200€ Field_Mouse Project: 100,50€ Hen Welfare League: 100€",
    );
  });

  it("picks the blocks by what was given", () => {
    const blocks: CampaignContent["blocks"] = [
      {
        id: "1",
        traits: { underTaxLimit: true },
        text: { et: "Maks", en: "" },
      },
      {
        id: "2",
        traits: { supportedUs: true },
        text: { et: "Toetus", en: "" },
      },
      {
        id: "3",
        traits: { gaveViaCompany: true },
        text: { et: "Ettevõte", en: "" },
      },
    ];
    expect(renderEmail(content({ blocks }), giver, context).text).toBe(
      "Maks\n\nToetus\n\nEttevõte",
    );
    const noIdCode = { ...giver, idCode: null };
    expect(renderEmail(content({ blocks }), noIdCode, context).text).toBe(
      "Toetus\n\nEttevõte",
    );
  });

  it("can't be used without a period", () => {
    const summary = content({
      blocks: [
        {
          id: "1",
          traits: { supportedUs: true },
          text: { et: "{{total}}", en: "{{total}}" },
        },
      ],
    });
    expect(errors(lint(summary, "yearly", [giver], {}, context))).toHaveLength(
      3,
    );
    expect(
      errors(lint(summary, "yearly", [giver], { period }, context)),
    ).toEqual([]);
  });

  it("warns about an empty value only for those who read it in that language", () => {
    const summary = content({
      blocks: [
        {
          id: "1",
          traits: {},
          text: { et: "Aitäh!", en: "Thanks: {{support}}" },
        },
      ],
    });
    const nonSupporter = (locale: "et" | "en"): Recipient => ({
      ...giver,
      donorId: locale === "et" ? 2 : 3,
      locale,
      gifts: {
        count: 1,
        byOrganization: [{ internalId: "amf", cents: 500 }],
        companyCents: 0,
      },
    });
    expect(
      lint(summary, "yearly", [nonSupporter("et")], { period }, context),
    ).toEqual([]);
    const issues = lint(
      summary,
      "yearly",
      [nonSupporter("et"), nonSupporter("en")],
      { period },
      context,
    );
    expect(issues.map((issue) => issue.message).join(" ")).toMatch(/\b1 donor/);
  });

  it("warns only about the donors who'd see an empty value", () => {
    const summary = content({
      blocks: [
        {
          id: "1",
          traits: { supportedUs: true },
          text: { et: "{{support}}", en: "{{support}}" },
        },
        { id: "2", traits: {}, text: { et: "Aitäh!", en: "Thank you!" } },
      ],
    });
    const nonSupporter: Recipient = {
      ...giver,
      donorId: 2,
      gifts: {
        count: 1,
        byOrganization: [{ internalId: "amf", cents: 500 }],
        companyCents: 0,
      },
    };
    expect(
      lint(summary, "yearly", [giver, nonSupporter], { period }, context),
    ).toEqual([]);
  });
});

describe("only these addresses", () => {
  it("stops an email whose list has something that isn't an address", () => {
    expect(
      errors(
        lint(content(), "newsletter", [mari], {
          emails: ["mari@example.com", "mari", "juku@example"],
        }),
      ),
    ).toEqual([
      {
        severity: "error",
        message:
          'In "Only these addresses", "mari" and "juku@example" aren\'t addresses: write whole addresses, like name@example.org.',
      },
    ]);
  });

  it("warns about an address that isn't in the group", () => {
    expect(
      lint(content(), "newsletter", [mari], {
        emails: ["mari@example.com", "juku@example.com"],
      }),
    ).toEqual([
      {
        severity: "warning",
        message:
          "juku@example.com isn't in the group, so it won't get it: not a donor, left out by another filter, or turned this kind of email off.",
      },
    ]);
  });
});

describe("a block for more than one thing", () => {
  const blocks: CampaignContent["blocks"] = [
    {
      id: "1",
      traits: { recurring: true, hasIdCode: false },
      text: { et: "Püsi, isikukoodita", en: "" },
    },
  ];

  it("is for the donors who are all of it", () => {
    expect(
      renderEmail(content({ blocks }), { ...mari, idCode: null }).text,
    ).toBe("Püsi, isikukoodita");
    expect(renderEmail(content({ blocks }), mari).text).toBe("");
  });

  it("is warned about when it reaches no one in the group", () => {
    expect(lint(content({ blocks }), "newsletter", [mari])).toContainEqual({
      severity: "warning",
      message:
        "Block 1 reaches no one in this group: no donor in it is all of what the block is for.",
    });
  });
});

describe("an email only in English", () => {
  const english = content({
    subject: { et: "", en: "News" },
    blocks: [{ id: "1", traits: {}, text: { et: "", en: "Hello!" } }],
  });
  const jaan: Recipient = { ...mari, donorId: 2, locale: "en" };

  it("goes to a group that reads English", () => {
    expect(errors(lint(english, "newsletter", [jaan]))).toEqual([]);
    expect(errors(lint(english, "newsletter", [], { locale: "en" }))).toEqual(
      [],
    );
  });

  it("is stopped for anyone it would reach in Estonian", () => {
    expect(
      errors(lint(english, "newsletter", [jaan, mari])).map(
        (issue) => issue.message,
      ),
    ).toEqual([
      "The Estonian subject is empty.",
      "1 donor gets an empty email: no block is for them, or none has text in their language or Estonian. Add a block for everyone, or narrow the group.",
    ]);
  });
});

describe("a donor no block is for", () => {
  const blocks: CampaignContent["blocks"] = [
    { id: "1", traits: { recurring: true }, text: { et: "Püsi", en: "" } },
    { id: "2", traits: { hasIdCode: true }, text: { et: "Kood", en: "" } },
  ];
  const oneOff: Recipient = {
    ...mari,
    donorId: 2,
    recurring: false,
    idCode: null,
  };

  it("stops the email, which would be empty for them", () => {
    expect(errors(lint(content({ blocks }), "newsletter", [mari]))).toEqual([]);
    expect(
      errors(lint(content({ blocks }), "newsletter", [mari, oneOff])),
    ).toEqual([
      {
        severity: "error",
        message:
          "1 donor gets an empty email: no block is for them, or none has text in their language or Estonian. Add a block for everyone, or narrow the group.",
      },
    ]);
  });
});

describe("pictures", () => {
  const ours = "https://res.cloudinary.com/demo/image/upload/v1/talgud.webp";
  const picture = (description: string, url = ours) =>
    content({
      blocks: [
        {
          id: "1",
          traits: {},
          text: {
            et: `![${description}](${url})`,
            en: `![${description}](${url})`,
          },
        },
      ],
    });

  it("asks for an email-safe picture, styled where it stands", () => {
    const { html } = renderEmail(picture("Talgupäev"), mari);
    expect(html).toContain(
      'src="https://res.cloudinary.com/demo/image/upload/c_limit,w_1200,q_auto/v1/talgud.jpg"',
    );
    expect(html).toContain('alt="Talgupäev"');
    expect(html).toContain("max-width: 100%");
    expect(html).not.toContain("width=");
  });

  it("gives a picture its width, which Outlook needs, at most the card's", () => {
    const widths: Record<string, number> = {
      [ours]: 1200,
      "https://res.cloudinary.com/demo/image/upload/v1/logo.png": 300,
    };
    const context: RenderContext = {
      organization: () => null,
      supportOrganization: null,
      taxRate: 22,
      pictureWidth: (url) => widths[url] ?? null,
    };
    expect(renderEmail(picture("Talgupäev"), mari, context).html).toContain(
      'width="520" style="display: block; width: 100%; max-width: 520px;',
    );
    expect(
      renderEmail(
        picture(
          "Logo",
          "https://res.cloudinary.com/demo/image/upload/v1/logo.png",
        ),
        mari,
        context,
      ).html,
    ).toContain('width="300"');
  });

  it("finds a picture whose description has brackets, as rendering does", () => {
    expect(imagesIn("![Talgud \\[2025\\]](https://x.org/a.png)")).toEqual([
      { description: "Talgud [2025]", url: "https://x.org/a.png" },
    ]);
    expect(
      lint(
        picture("Talgud \\[2025\\]", "https://example.org/x.jpg"),
        "newsletter",
        [mari],
      ).map((issue) => issue.severity),
    ).toEqual(["warning", "warning"]);
    expect(imagesIn("`![kood](https://x.org/a.png)`")).toEqual([]);
  });

  it("can't go out without a description", () => {
    expect(errors(lint(picture(""), "newsletter", [mari]))).toHaveLength(2);
  });

  it("warns about a picture from elsewhere", () => {
    expect(
      lint(picture("Talgupäev", "https://example.org/x.jpg"), "newsletter", [
        mari,
      ]),
    ).toHaveLength(2);
  });
});
