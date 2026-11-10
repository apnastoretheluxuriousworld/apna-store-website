// Static site config. Categories now come from the database (getStoreCategories);
// this list is only the fallback when the DB is unreachable.

export const site = {
  name: "Apna Store",
  tagline: "The Luxurious World",
  description:
    "Apna Store — curated luxury watches, shoes, handbags, wallets and fragrances.",
};

export type NavCategory = { name: string; slug: string; blurb: string; imageUrl?: string | null };

export const categories: NavCategory[] = [
  { name: "Watches", slug: "watches", blurb: "Timepieces of distinction" },
  { name: "Handbags", slug: "handbags", blurb: "Icons for her" },
  { name: "Shoes", slug: "shoes", blurb: "Crafted for every step" },
  { name: "Sunglasses", slug: "sunglasses", blurb: "Statement eyewear" },
  { name: "Wallets", slug: "wallets", blurb: "Refined essentials" },
  { name: "Belts", slug: "belts", blurb: "The finishing detail" },
  { name: "Caps", slug: "caps", blurb: "Crowned in style" },
  { name: "Perfumes", slug: "perfumes", blurb: "Signature scents" },
];

export const secondaryLinks = [
  { label: "My Account", href: "/account" },
  { label: "About Us", href: "/about" },
  { label: "Contact", href: "/contact" },
];
