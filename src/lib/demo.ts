// DEMO DATA used until the client's real catalog arrives. Products move to the
// database in F5/F6. Images under /public/demo are DUMMY and must be replaced
// with the client's own photos before launch (many show third-party brands).

export type DemoProduct = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  price: number;
  rating: number;
  reviews: number;
  image?: string;
};

const img = (category: string, file: string) => `/demo/${category}/${file}.webp`;

type Row = [name: string, subtitle: string, price: number, rating: number, reviews: number, file?: string];

const rows: Record<string, Row[]> = {
  watches: [
    ["Aurum Chronograph", "18K gold tone · 42mm", 48500, 4.9, 128, "aurum-chronograph"],
    ["Glacier Moonphase", "Ceramic · Blue baguette bezel", 86000, 4.9, 57, "glacier-moonphase"],
    ["Rosé Pavé Chronograph", "Rose gold · Diamond set", 124000, 5.0, 41, "rose-pave-chronograph"],
    ["Emerald Racer", "Yellow gold · Green dial", 98000, 4.9, 73, "emerald-racer"],
    ["Noir Chronograph", "Two-tone steel · 41mm", 32500, 4.7, 152, "noir-chronograph"],
  ],
  handbags: [
    ["Bordeaux Flap Bag", "Leather & suede · Gold hardware", 42000, 4.8, 64, "bordeaux-flap-bag"],
    ["Gilded Croc Tote", "Croc-embossed · Gold piping", 39500, 4.7, 38, "gilded-croc-tote"],
    ["Aurelia Top Handle", "Croc-embossed · Sculpted handle", 34000, 4.8, 51, "aurelia-top-handle"],
    ["Noir Chain Shoulder Bag", "Quilted leather · Chain strap", 46500, 4.9, 89, "noir-chain-shoulder-bag"],
  ],
  shoes: [
    ["Patent Oxford", "Patent leather · Lace-up", 16500, 4.7, 92, "patent-oxford"],
    ["Midnight Glitter Oxford", "Patent & glitter · Gold welt", 19800, 4.8, 44, "midnight-glitter-oxford"],
    ["Monk Strap Patent", "Double monk · Perforated", 21500, 4.8, 67, "monk-strap-patent"],
  ],
  sunglasses: [
    ["Aviator Noir", "Gold frame · Dark lens", 14500, 4.8, 110, "aviator-noir"],
    ["Regal Shield", "Gold & black · Shield lens", 18900, 4.7, 46, "regal-shield"],
    ["Silver Square Aviator", "Silver frame · Polarised", 12900, 4.6, 78, "silver-square-aviator"],
  ],
  wallets: [
    ["Motorsport Card Wallet", "Leather · Crest emblem", 6900, 4.6, 120, "motorsport-card-wallet"],
    ["Embossed Card Holder", "Black leather · Slim", 4900, 4.7, 84, "embossed-card-holder"],
    ["Heritage Bifold Tan", "Saffiano leather · Tan", 7900, 4.6, 152, "heritage-bifold-tan"],
    ["Espresso Bifold Gift Set", "Full-grain leather · Gift box", 8500, 4.8, 61, "espresso-bifold-gift-set"],
  ],
  belts: [
    ["Onyx Auto-Lock Belt", "Leather · Ratchet buckle", 5900, 4.6, 73, "onyx-auto-lock-belt"],
    ["Stallion Buckle Belt", "Leather · Gold stallion buckle", 7400, 4.7, 58, "stallion-buckle-belt"],
    ["Signature Pebble Belt", "Pebbled leather · Signature buckle", 11500, 4.8, 49, "signature-pebble-belt"],
  ],
  caps: [
    ["Monogram Suede Cap", "Suede · Embossed monogram", 6500, 4.6, 40, "monogram-suede-cap"],
    ["Monogram Bucket Hat", "Jacquard · Reversible", 7200, 4.5, 33, "monogram-bucket-hat"],
    ["Crystal Crest Cap", "Crystal embellished · Gold crest", 9800, 4.8, 27, "crystal-crest-cap"],
  ],
  perfumes: [
    ["Velora", "Eau de Parfum · 100ml", 12900, 4.8, 214, "velora-eau-de-parfum"],
    ["Oud Santal", "Eau de Parfum · 100ml", 15400, 4.9, 96, "oud-santal"],
    ["Crown Amber", "Extrait · 100ml", 18500, 4.8, 58, "crown-amber"],
    ["Azure Royale Attar", "Concentrated attar · 12ml", 6900, 4.9, 142, "azure-royale-attar"],
  ],
};

export const demoProducts: DemoProduct[] = Object.entries(rows).flatMap(([category, list]) =>
  list.map(([name, subtitle, price, rating, reviews, file], i) => ({
    id: `${category}-${i + 1}`,
    name,
    subtitle,
    category,
    price,
    rating,
    reviews,
    image: file ? img(category, file) : undefined,
  })),
);

export function demoProductsIn(category: string) {
  return demoProducts.filter((p) => p.category === category);
}

/** First photo in a category, used as its cover. */
export function demoCover(category: string) {
  return demoProductsIn(category).find((p) => p.image)?.image;
}

const bestSellerIds = [
  "watches-1", "handbags-4", "perfumes-1", "sunglasses-1",
  "watches-3", "handbags-1", "perfumes-4", "shoes-3",
];
export const demoBestSellers = bestSellerIds.map((id) => demoProducts.find((p) => p.id === id)!);

/** Cover images for the reels strip (videos arrive in F7). */
export const demoReels = [
  { title: "Watches", poster: img("watches", "noir-chronograph") },
  { title: "Handbags", poster: img("handbags", "noir-chain-shoulder-bag") },
  { title: "Perfumes", poster: img("perfumes", "azure-royale-attar") },
  { title: "Shoes", poster: img("shoes", "monk-strap-patent") },
  { title: "Sunglasses", poster: img("sunglasses", "regal-shield") },
  { title: "Belts", poster: img("belts", "stallion-buckle-belt") },
];

export const demoTestimonials = [
  { name: "Ayesha K.", city: "Hyderabad", text: "The packaging alone felt like a gift. My watch arrived exactly as pictured — flawless." },
  { name: "Rahul M.", city: "Mumbai", text: "Genuinely premium service. They helped me pick a fragrance over WhatsApp and it's now my signature." },
  { name: "Sana F.", city: "Bengaluru", text: "Beautiful bag, quick delivery and a team that actually cares. Will shop again." },
];
