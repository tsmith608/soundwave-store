/**
 * Real customer reviews only. Add entries after an order is delivered and the
 * customer has agreed to publication (keep the order id for your records).
 * Never add invented, paid-for or staff reviews: the FTC rule on fake
 * reviews and testimonials (16 CFR Part 465, in force since Oct 2024) makes
 * fabricated reviews a civil-penalty offence.
 */
export interface Review {
  name: string; // as the customer wants it shown, e.g. "Priya S."
  location?: string;
  designId: string;
  occasion?: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  date: string; // YYYY-MM-DD
  orderId: string; // not shown publicly
  photo?: string; // customer-supplied photo in /public/reviews/, with permission
}

export const REVIEWS: Review[] = [];
