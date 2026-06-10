// Service category registry — the single source of truth for what Aangan offers.
// Add a new category here; the Home hub, post form, and category feeds all read from this.

export type ServiceKind = 'food' | 'listing';
export type ListingType = 'service' | 'product' | 'post' | 'recommendation';
export type CtaVerb = 'order' | 'inquire' | 'buy' | 'contact' | 'book';

export interface AttrField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'toggle';
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

export interface ServiceCategory {
  key: string;
  label: string;
  blurb: string;
  icon: string;          // Ionicons name
  color: string;         // tile/badge accent
  kind: ServiceKind;
  listingType?: ListingType;
  cta: CtaVerb;
  ctaLabel: string;
  attributes: AttrField[];
  priceLabel?: string;   // "per plate", "per month", etc. — null = free/negotiable
  enabled: boolean;
  order: number;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  {
    key: 'food',
    label: 'Home Food',
    blurb: "See what your neighbours are cooking today",
    icon: 'restaurant',
    color: '#E8650A',
    kind: 'food',
    cta: 'order',
    ctaLabel: 'Reserve plates',
    priceLabel: 'per plate',
    attributes: [],
    enabled: true,
    order: 0,
  },
  {
    key: 'tuition',
    label: 'Tuitions',
    blurb: 'Classes for kids & adults in the building',
    icon: 'school',
    color: '#4F80E2',
    kind: 'listing',
    listingType: 'service',
    cta: 'inquire',
    ctaLabel: 'Inquire',
    priceLabel: 'per month / session',
    attributes: [
      { key: 'subject', label: 'Subject / Class', type: 'text', required: true, placeholder: 'Math, Physics, Coding…' },
      { key: 'grade', label: 'Grade / Level', type: 'text', placeholder: 'Grade 6–10, JEE, Any' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['Home visit', 'Online', 'At my place', 'Flexible'] },
      { key: 'batch_size', label: 'Batch size', type: 'select', options: ['1-on-1', 'Small group (2–5)', 'Group (5+)'] },
    ],
    enabled: true,
    order: 1,
  },
  {
    key: 'tailoring',
    label: 'Tailoring',
    blurb: 'Alterations, blouses & custom stitching',
    icon: 'cut',
    color: '#9B59B6',
    kind: 'listing',
    listingType: 'service',
    cta: 'inquire',
    ctaLabel: 'Inquire',
    priceLabel: 'per piece / fixed',
    attributes: [
      { key: 'speciality', label: 'Specialities', type: 'multiselect', options: ['Blouse', 'Salwar', 'Kurta', 'Western', 'Alterations', 'Kids wear'] },
      { key: 'turnaround', label: 'Turnaround', type: 'select', options: ['Same day', '2–3 days', 'Within a week', 'Flexible'] },
      { key: 'home_pickup', label: 'Home pickup / delivery', type: 'toggle' },
    ],
    enabled: true,
    order: 2,
  },
  {
    key: 'tax',
    label: 'Income Tax',
    blurb: 'ITR, GST & tax advisory from neighbours',
    icon: 'calculator',
    color: '#27AE60',
    kind: 'listing',
    listingType: 'service',
    cta: 'book',
    ctaLabel: 'Book consultation',
    priceLabel: 'per filing / hour',
    attributes: [
      { key: 'services', label: 'Services offered', type: 'multiselect', options: ['ITR filing', 'GST', 'TDS', 'Tax planning', 'Auditing', 'Accounting'] },
      { key: 'credentials', label: 'Credentials', type: 'text', placeholder: 'CA, CS, MBA Finance…' },
      { key: 'experience', label: 'Experience', type: 'select', options: ['1–3 years', '3–5 years', '5–10 years', '10+ years'] },
    ],
    enabled: true,
    order: 3,
  },
  {
    key: 'clinic',
    label: 'Clinic',
    blurb: 'Doctors & health services in the society',
    icon: 'medkit',
    color: '#E74C3C',
    kind: 'listing',
    listingType: 'service',
    cta: 'book',
    ctaLabel: 'Book appointment',
    priceLabel: 'per consultation',
    attributes: [
      { key: 'speciality', label: 'Speciality', type: 'text', required: true, placeholder: 'General physician, Dentist, Physio…' },
      { key: 'timings', label: 'Timings', type: 'text', placeholder: 'Mon–Sat, 6–8 PM' },
      { key: 'location', label: 'Location', type: 'text', placeholder: 'Flat A-101 or nearby clinic' },
      { key: 'home_visit', label: 'Home visits available', type: 'toggle' },
    ],
    enabled: true,
    order: 4,
  },
  {
    key: 'catering',
    label: 'Catering',
    blurb: 'Home-made catering for events & functions',
    icon: 'fast-food',
    color: '#FF9800',
    kind: 'listing',
    listingType: 'service',
    cta: 'inquire',
    ctaLabel: 'Get a quote',
    priceLabel: 'per plate / event',
    attributes: [
      { key: 'cuisines', label: 'Cuisines', type: 'multiselect', options: ['North Indian', 'South Indian', 'Gujarati', 'Jain', 'Continental', 'Chinese', 'Snacks', 'Sweets'] },
      { key: 'event_types', label: 'Event types', type: 'multiselect', options: ['Housewarming', 'Pooja', 'Birthday', 'Wedding', 'Corporate', 'Any'] },
      { key: 'min_order', label: 'Minimum order (plates)', type: 'number' },
    ],
    enabled: true,
    order: 5,
  },
  {
    key: 'decoration',
    label: 'Decoration',
    blurb: 'Decor for events, festivals & occasions',
    icon: 'color-palette',
    color: '#FF6B9D',
    kind: 'listing',
    listingType: 'service',
    cta: 'inquire',
    ctaLabel: 'Get a quote',
    priceLabel: 'per event',
    attributes: [
      { key: 'event_types', label: 'Event types', type: 'multiselect', options: ['Housewarming', 'Birthday', 'Wedding', 'Festival', 'Office', 'Any'] },
      { key: 'style', label: 'Style', type: 'multiselect', options: ['Traditional', 'Modern', 'Floral', 'Balloon', 'Themed', 'Minimal'] },
      { key: 'includes_material', label: 'Material included in price', type: 'toggle' },
    ],
    enabled: true,
    order: 6,
  },
  {
    key: 'jobs',
    label: 'Job Referral',
    blurb: 'Help neighbours find or offer opportunities',
    icon: 'briefcase',
    color: '#00BCD4',
    kind: 'listing',
    listingType: 'post',
    cta: 'contact',
    ctaLabel: 'Connect',
    attributes: [
      { key: 'kind', label: 'I am', type: 'select', options: ['Offering a job', 'Looking for a job'], required: true },
      { key: 'role', label: 'Role / Position', type: 'text', required: true, placeholder: 'Software Engineer, Data Analyst…' },
      { key: 'company', label: 'Company / Industry', type: 'text', placeholder: 'TCS, Banking, Startup…' },
      { key: 'work_mode', label: 'Work mode', type: 'select', options: ['Remote', 'Office', 'Hybrid'] },
    ],
    enabled: true,
    order: 7,
  },
  {
    key: 'market',
    label: 'Buy & Sell',
    blurb: 'Second-hand goods among neighbours',
    icon: 'bag-handle',
    color: '#8D6E63',
    kind: 'listing',
    listingType: 'product',
    cta: 'buy',
    ctaLabel: 'Buy / Offer',
    priceLabel: 'asking price',
    attributes: [
      { key: 'condition', label: 'Condition', type: 'select', options: ['Brand new', 'Like new', 'Good', 'Fair'], required: true },
      { key: 'category', label: 'Category', type: 'select', options: ['Electronics', 'Furniture', 'Clothes', 'Books', 'Toys', 'Kitchen', 'Sports', 'Other'] },
      { key: 'brand', label: 'Brand / Model', type: 'text' },
    ],
    enabled: true,
    order: 8,
  },
  {
    key: 'directory',
    label: 'Service Directory',
    blurb: 'Recommend trusted plumbers, maids & more',
    icon: 'construct',
    color: '#607D8B',
    kind: 'listing',
    listingType: 'recommendation',
    cta: 'contact',
    ctaLabel: 'Get contact',
    attributes: [
      { key: 'trade', label: 'Trade / Service', type: 'select', required: true, options: ['Plumber', 'Electrician', 'Carpenter', 'Painter', 'Maid / Bai', 'Cook', 'Driver', 'AC Repair', 'Security', 'Other'] },
      { key: 'area', label: 'Area served', type: 'text', placeholder: 'Andheri West, or Anywhere in Mumbai' },
      { key: 'verified', label: 'Personally verified / used', type: 'toggle' },
    ],
    enabled: true,
    order: 9,
  },
  {
    key: 'daycare',
    label: 'Day Care',
    blurb: 'Childcare & creche services in the society',
    icon: 'happy',
    color: '#F59E0B',
    kind: 'listing',
    listingType: 'service',
    cta: 'inquire',
    ctaLabel: 'Inquire',
    priceLabel: 'per month / day',
    attributes: [
      { key: 'age_range', label: 'Age group', type: 'multiselect', required: true, options: ['Infant (0–1 yr)', 'Toddler (1–3 yrs)', 'Preschool (3–6 yrs)', 'After school (6–12 yrs)'] },
      { key: 'timings', label: 'Timings', type: 'text', placeholder: 'Mon–Sat, 8 AM – 7 PM' },
      { key: 'capacity', label: 'Max children', type: 'number', placeholder: '5' },
      { key: 'meals_included', label: 'Meals / snacks included', type: 'toggle' },
      { key: 'pickup_drop', label: 'Pickup & drop available', type: 'toggle' },
    ],
    enabled: true,
    order: 10,
  },
  {
    key: 'fitness',
    label: 'Yoga & Fitness',
    blurb: 'Yoga, Zumba & fitness training in the building',
    icon: 'body',
    color: '#10B981',
    kind: 'listing',
    listingType: 'service',
    cta: 'inquire',
    ctaLabel: 'Join class',
    priceLabel: 'per month / session',
    attributes: [
      { key: 'type', label: 'Activity type', type: 'multiselect', required: true, options: ['Yoga', 'Zumba', 'Gym training', 'Meditation', 'Pilates', 'Aerobics', 'Other'] },
      { key: 'level', label: 'Level', type: 'select', options: ['Beginner', 'All levels', 'Intermediate', 'Advanced'] },
      { key: 'format', label: 'Format', type: 'select', options: ['Group class', '1-on-1', 'Online', 'Hybrid'] },
      { key: 'timings', label: 'Timings', type: 'text', placeholder: '6–7 AM & 6–7 PM, Mon–Sat' },
      { key: 'gender', label: 'Open to', type: 'select', options: ['All genders', 'Women only', 'Men only'] },
    ],
    enabled: true,
    order: 11,
  },
  {
    key: 'arts',
    label: 'Arts & Activities',
    blurb: 'Dance, painting, music & creative classes',
    icon: 'musical-notes',
    color: '#EC4899',
    kind: 'listing',
    listingType: 'service',
    cta: 'inquire',
    ctaLabel: 'Inquire',
    priceLabel: 'per month / session',
    attributes: [
      { key: 'type', label: 'Activity', type: 'multiselect', required: true, options: ['Dance', 'Painting', 'Music', 'Craft', 'Drama', 'Drawing / Sketching', 'Pottery', 'Other'] },
      { key: 'age_group', label: 'Age group', type: 'multiselect', options: ['Kids (5–12)', 'Teens (13–18)', 'Adults', 'All ages'] },
      { key: 'format', label: 'Format', type: 'select', options: ['Group class', '1-on-1', 'Online', 'At my place'] },
      { key: 'style', label: 'Style / Specialisation', type: 'text', placeholder: 'Bharatnatyam, Watercolour, Hindustani vocal…' },
      { key: 'timings', label: 'Timings', type: 'text', placeholder: 'Weekends 10 AM – 12 PM' },
    ],
    enabled: true,
    order: 12,
  },
  {
    key: 'astrology',
    label: 'Astrology',
    blurb: 'Horoscopes, kundali & vastu from neighbours',
    icon: 'planet',
    color: '#7C3AED',
    kind: 'listing',
    listingType: 'service',
    cta: 'book',
    ctaLabel: 'Book consultation',
    priceLabel: 'per session',
    attributes: [
      { key: 'services', label: 'Services offered', type: 'multiselect', required: true, options: ['Horoscope reading', 'Kundali matching', 'Vastu consultation', 'Numerology', 'Tarot', 'Palmistry', 'Gemstone advice', 'Other'] },
      { key: 'mode', label: 'Consultation mode', type: 'select', options: ['In-person', 'Phone / video call', 'Both'] },
      { key: 'experience', label: 'Experience', type: 'select', options: ['1–3 years', '3–5 years', '5–10 years', '10+ years'] },
      { key: 'languages', label: 'Languages', type: 'text', placeholder: 'Hindi, English, Gujarati…' },
    ],
    enabled: true,
    order: 13,
  },
  {
    key: 'carpooling',
    label: 'Carpooling',
    blurb: 'Share rides and split costs with neighbours going your way',
    icon: 'car-outline',
    color: '#0EA5E9',
    kind: 'listing',
    listingType: 'service',
    cta: 'inquire',
    ctaLabel: 'Join ride',
    priceLabel: '/trip',
    attributes: [
      { key: 'from', label: 'Departure point', type: 'text', required: true, placeholder: 'Society gate, nearest landmark…' },
      { key: 'to', label: 'Destination', type: 'text', required: true, placeholder: 'Office, railway station, airport…' },
      { key: 'schedule', label: 'Schedule', type: 'select', required: true, options: ['Daily', 'Weekdays only', 'Weekends only', 'One-time'] },
      { key: 'departure_time', label: 'Departure time', type: 'text', required: true, placeholder: '8:30 AM' },
      { key: 'seats', label: 'Seats available', type: 'number', placeholder: '2' },
      { key: 'preference', label: 'Preference', type: 'select', options: ['All welcome', 'Women only', 'Men only'] },
    ],
    enabled: true,
    order: 14,
  },
];
export function getService(key: string): ServiceCategory | undefined {
  return SERVICE_CATEGORIES.find((s) => s.key === key);
}

/** All enabled categories in sort order. */
export const SERVICES = SERVICE_CATEGORIES.filter((s) => s.enabled).sort((a, b) => a.order - b.order);
