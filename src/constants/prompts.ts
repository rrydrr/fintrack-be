export const RECEIPT_SYSTEM_PROMPT =
  "You are a specialized receipt data extraction assistant. Analyze the image and extract all receipt details strictly in JSON format matching the schema provided by the user. Do not include markdown code blocks or explanatory text outside the JSON.";

export const RECEIPT_USER_PROMPT = `Extract all data from this receipt and map it into the following JSON schema:

{
  "merchant": {
    "name": "string",
    "address": "string",
    "phone": "string"
  },
  "transaction": {
    "date": "YYYY-MM-DD",
    "time": "HH:MM",
    "invoice_number": "string",
    "payment_method": "string",
    "currency": "string"
  },
  "items": [
    {
      "description": "string",
      "quantity": 0,
      "unit_price": 0.0,
      "total_price": 0.0
    }
  ],
  "financials": {
    "subtotal": 0.0,
    "tax": 0.0,
    "service_charge": 0.0,
    "discount": 0.0,
    "total": 0.0
  }
}

If any field is missing or unreadable, set its value to null.`;
