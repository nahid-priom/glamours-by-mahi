export const brandConfig = {
  name: 'Glamourous by Mahi',
  shortName: 'Glamourous',
  description: 'Multi-Branch Fashion Retail & E-commerce Business Automation System',
  tagline: 'Premium fashion for every occasion',
  currency: 'BDT',
  currencySymbol: '৳',
  locale: 'en-BD',
  primaryLocation: 'Bashundhara City Shopping Mall',
  address: 'Level 2, Bashundhara City Shopping Mall, Panthapath, Dhaka',
  phone: '01700-000001',
  email: 'hello@glamourousbymahi.com',
  website: 'https://glamourousbymahi.com',
  themeColor: '#F8F6F2',
  backgroundColor: '#F8F6F2',
  accentColor: '#E11D48',
  textColor: '#111111',
} as const

export type BrandConfig = typeof brandConfig
