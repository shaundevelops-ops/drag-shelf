import crypto from "node:crypto";
import fs from "node:fs";

const TOTAL_INVITES = 20;

const codes = [];

for (let i = 0; i < TOTAL_INVITES; i++) {
  const raw = crypto
    .randomBytes(8)
    .toString("hex")
    .toUpperCase();

  const code = `DRAGSHELF-${raw}`;

  const hash = crypto
    .createHash("sha256")
    .update(code)
    .digest("hex");

  codes.push({
    code,
    hash,
  });
}

const sqlValues = codes
  .map(
    ({ hash }) =>
      `('${hash}')`
  )
  .join(",\n");

const sql = `
INSERT INTO public.beta_invites (code_hash)
VALUES
${sqlValues};
`;

fs.writeFileSync(
  "beta-invites.sql",
  sql,
  "utf8"
);

fs.writeFileSync(
  "beta-invite-codes.txt",
  codes.map((item) => item.code).join("\n"),
  "utf8"
);

console.log("20 beta invitation codes generated.");
console.log("SQL file: beta-invites.sql");
console.log("Private codes: beta-invite-codes.txt");