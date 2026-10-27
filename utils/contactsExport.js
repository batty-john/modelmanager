/**
 * Parent/guardian contact list for marketing exports (admin only).
 * One row per non-admin account, deduplicated by email. Children's details are never included.
 */
const COLUMNS = ['first_name', 'last_name', 'email', 'phone', 'preferred_contact', 'signed_up'];

// Quote every field and neutralise spreadsheet formulas (values starting with = + - @ or a
// control char), since every field here comes from the public sign-up form.
function csvField(value) {
  let s = value == null ? '' : String(value);
  // Plain phone numbers like "+1 (801) 555-0100" can't carry a formula, so leave them readable.
  if (/^[=+\-@\t\r]/.test(s) && !/^[+\-][\d\s().-]+$/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function toDate(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : '';
}

function contactsCsv(users) {
  const seen = new Set();
  const lines = [COLUMNS.join(',')];
  for (const u of users) {
    const email = (u.email || '').trim().toLowerCase();
    if (!email.includes('@') || seen.has(email)) continue;
    seen.add(email);
    lines.push(
      [u.parentFirstName, u.parentLastName, email, u.parentPhone, u.preferredContact, toDate(u.createdAt)]
        .map(csvField)
        .join(',')
    );
  }
  return { csv: lines.join('\r\n') + '\r\n', count: lines.length - 1 };
}

module.exports = { contactsCsv };
