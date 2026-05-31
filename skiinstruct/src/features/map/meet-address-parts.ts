export type MeetAddressFields = {
  city: string;
  street: string;
  house: string;
};

/** Дополняет поля адреса из строки, если компоненты пустые. */
export function enrichMeetAddressFields(
  parts: MeetAddressFields,
  displayLine: string,
): MeetAddressFields {
  let { city, street, house } = parts;

  if (!street.trim() && displayLine.trim()) {
    const commaParts = displayLine.split(",").map((p) => p.trim()).filter(Boolean);
    if (commaParts.length >= 2) {
      street = commaParts[0];
      if (!city.trim()) city = commaParts[1];
    } else if (commaParts.length === 1) {
      street = commaParts[0];
    }
  }

  const houseMatch = displayLine.match(/\b(?:д\.?|дом)\s*(\d+[a-zA-Zа-яА-ЯёЁ/-]*)/i);
  if (!house.trim() && houseMatch) {
    house = houseMatch[1];
  }

  return { city: city.trim(), street: street.trim(), house: house.trim() };
}
