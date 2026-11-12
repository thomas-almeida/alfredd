export function normalizeWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.startsWith("55") && digits.length > 11 ? digits.slice(2) : digits;
  return localDigits.slice(0, 11);
}

export function formatWhatsapp(value: string) {
  const digits = normalizeWhatsapp(value);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isRepeatedPattern(value: string) {
  const compact = value.toLowerCase().replace(/\s/g, "");
  return /^(.)\1{4,}$/.test(compact) || /^(.{1,3})\1{2,}$/.test(compact);
}

export function validateLeadFields({ name, email, whatsapp }: { name: string; email: string; whatsapp: string }) {
  const cleanName = name.trim().replace(/\s+/g, " ");
  const cleanEmail = email.trim().toLowerCase();
  const phone = normalizeWhatsapp(whatsapp);
  const [emailLocal = "", emailDomain = ""] = cleanEmail.split("@");

  if (cleanName.length < 2 || cleanName.length > 120 || !/[A-Za-zÀ-ÿ]/.test(cleanName) || isRepeatedPattern(cleanName)) return "Informe um nome válido.";
  if (!/^\S+@\S+\.\S{2,}$/.test(cleanEmail) || cleanEmail.length > 254 || isRepeatedPattern(emailLocal)) return "Informe um e-mail válido.";
  if (!emailDomain.includes(".") || phone.length < 10 || phone.length > 11 || isRepeatedPattern(phone)) return "Informe um WhatsApp válido.";
  return null;
}
