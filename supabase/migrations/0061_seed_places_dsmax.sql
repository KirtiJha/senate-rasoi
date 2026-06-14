-- ════════════════════════════════════════════════════════════════════
-- Aangan — migration 0061: Seed "Nearby" for DS Max Senate (Begur, Bangalore)
-- Run AFTER 0060.
--
-- 94 real nearby places sourced from OpenStreetMap (© OpenStreetMap
-- contributors, ODbL) around Begur (≈ 12.8739, 77.6258).
-- Counts: hospital 9, clinic 8, pharmacy 8, school 14, daycare 4, grocery 12, salon 5, restaurant 14, gym 1, bank 12, petrol 2, worship 5.
--
-- Idempotent: each row is skipped if a place with the same name already exists
-- in this community, so re-running won't create duplicates. Attributed to the
-- community's admin (falls back to its earliest member); a no-op if neither
-- exists yet.
-- ════════════════════════════════════════════════════════════════════

with seeder as (
  select id from public.profiles
  where community_id = 'd836e935-4622-4289-8136-11ca73b54a39'
  order by (roles @> '{admin}'::text[]) desc, created_at asc
  limit 1
)
insert into public.places (community_id, created_by, place_type, name, address, lat, lng, phone, website, hours)
select 'd836e935-4622-4289-8136-11ca73b54a39', (select id from seeder), v.place_type, v.name, v.address, v.lat, v.lng, v.phone, v.website, v.hours
from (values
  ('hospital', 'Brahmi Ayurvedic Center', '311-B, 12th Main Road, Behind Ingu Tengu Restaurant, Off Bannerghatta Road, Shantiniketan Layout, Karnataka, 560076', 12.8830054, 77.6073285, '+9190086 54547', 'brahmi-ayurveda.com', null),
  ('hospital', 'Ganesh Nursing Home, Bengaluru Urban', null, 12.8957636, 77.6330289, null, null, null),
  ('hospital', 'Government Primary Healthcare Center, Begur', null, 12.8778532, 77.6246582, null, null, null),
  ('hospital', 'Jayashree Multi Specilaity Hospital', null, 12.881611, 77.6260763, null, null, null),
  ('hospital', 'Live100', null, 12.8791713, 77.6454925, null, null, null),
  ('hospital', 'Nayantara Opticals', null, 12.8924828, 77.6198497, null, null, null),
  ('hospital', 'Sai Sparsh Hospital', null, 12.8933895, 77.6368614, null, null, null),
  ('hospital', 'Sri Sapthagiri Clinic', null, 12.8736928, 77.6449626, null, null, null),
  ('hospital', 'Vinayaka Health Care and Maternity Home', null, 12.8919999, 77.6257829, null, null, null),
  ('clinic', 'Apollo Clinic', null, 12.8743639, 77.6406876, null, null, null),
  ('clinic', 'Dr. Hebbal Homeo and Polyclinic', null, 12.877267, 77.6182941, null, null, null),
  ('clinic', 'Dr. Shankar''s Ear Nose & Throat', null, 12.874266, 77.616922, null, null, null),
  ('clinic', 'Health Gate Diagnostics & Multi-speciality clinic', 'No. 739, 12th Main, AECS layout, B Block, Singasandra, 560068', 12.8791199, 77.6382724, '7338393399', null, null),
  ('clinic', 'Mahima Clinic', null, 12.87174, 77.6168758, null, null, null),
  ('clinic', 'Niyati Children Clinic', null, 12.881902, 77.612665, null, null, null),
  ('clinic', 'Swarna Clinic', null, 12.884216, 77.613358, null, null, null),
  ('clinic', 'Vijaya Medical Centre', null, 12.892281, 77.6112304, null, null, null),
  ('pharmacy', 'Apollo Pharmacy', null, 12.8928115, 77.6199345, null, null, null),
  ('pharmacy', 'Balaji Medicals', null, 12.8737728, 77.6449481, null, null, null),
  ('pharmacy', 'Greeshma', null, 12.8761792, 77.6169752, null, null, null),
  ('pharmacy', 'Kanyashree Daignostics', null, 12.8921612, 77.6257291, null, null, null),
  ('pharmacy', 'MedPlus', null, 12.8774214, 77.6388932, null, null, null),
  ('pharmacy', 'Narayana Pharmacy', null, 12.8773772, 77.6389141, null, null, null),
  ('pharmacy', 'Sanjeevani Medicals', null, 12.8780838, 77.6384592, null, null, null),
  ('pharmacy', 'Trust Chemists & Druggists', null, 12.8928095, 77.6197262, null, 'https://www.trustpharmacy.co.in/', null),
  ('school', 'BCR Public school', 'Begur Lake Road', 12.8814976, 77.6352146, null, null, null),
  ('school', 'Begur Channarayappa Ramiya, Chikkabegur', null, 12.8818317, 77.6358456, null, null, null),
  ('school', 'Cresent Eng School, Begur', null, 12.8714779, 77.6355626, null, null, null),
  ('school', 'GLPS Chikkabegur', null, 12.8801561, 77.6341829, null, null, null),
  ('school', 'GLPS Subhash Nagar, Begur', null, 12.8707092, 77.6384891, null, null, null),
  ('school', 'Government Primary School Yelenahalli', null, 12.867378, 77.6162668, null, null, null),
  ('school', 'GUHPS Subhash Nagar', null, 12.8733, 77.6392183, null, null, null),
  ('school', 'Jnanajyothi Eng School, Begur', null, 12.8808502, 77.6370167, null, null, null),
  ('school', 'Little Angel Eng School, Begur', null, 12.8706196, 77.638, null, null, null),
  ('school', 'Priyadarshini School, Begur', null, 12.8755953, 77.6388735, null, null, null),
  ('school', 'St Pauls School, Begur', null, 12.8780562, 77.6167931, null, null, null),
  ('school', 'St Teresa Hps Begur', null, 12.8730251, 77.6260135, null, null, null),
  ('school', 'St Teresa Hs', null, 12.8737507, 77.6259345, null, null, null),
  ('school', 'The Selony LPS Begur', null, 12.8826959, 77.6265059, null, null, null),
  ('daycare', 'Little Elly Preschool', null, 12.8738255, 77.6428925, null, null, null),
  ('daycare', 'Maple Bear Canadian Pre-school', null, 12.8785294, 77.6385091, '63666 88881', 'http://www.maplebear.in/singasandra/', null),
  ('daycare', 'Rayen Kids', null, 12.8927015, 77.6192826, null, null, null),
  ('daycare', 'Special Me Preschool & DayCare', null, 12.8769807, 77.6392545, null, null, null),
  ('grocery', 'Ample Mart', 'Akshayanagar, 560068', 12.8759179, 77.6167938, null, null, null),
  ('grocery', 'Ayush Fresh Patanjali', 'DLF New Town,, Nyanappanahalli, 560076', 12.8759246, 77.6131681, '6361018187, 6361011535', null, null),
  ('grocery', 'Day To Day', null, 12.8759127, 77.6397852, null, null, null),
  ('grocery', 'Ezeebag', null, 12.8736603, 77.6114062, null, null, null),
  ('grocery', 'Fathima food choice', null, 12.8780028, 77.638532, null, null, null),
  ('grocery', 'Magizh Groceries', null, 12.87924, 77.6383068, null, null, null),
  ('grocery', 'Mamata', null, 12.8762947, 77.6164979, null, null, null),
  ('grocery', 'Pearl City Super Market', '3/6, Devarachikkanahalli Road, 560076', 12.8831879, 77.6102566, '(91)-80-41534792', null, null),
  ('grocery', 'Safari Super Mart', null, 12.8749232, 77.6167526, null, null, 'Mo-Su 09:00-21:00'),
  ('grocery', 'Span Retail', '929, Devarachikkanahalli Road, 560076', 12.8925021, 77.6116554, '(91)-9535807361', null, null),
  ('grocery', 'Star Bazar', 'Begur - Hulimavu Road, 560076', 12.8762997, 77.6167172, null, null, null),
  ('grocery', 'Store', 'Manipal County Road', 12.8737198, 77.6448305, null, null, null),
  ('salon', 'gents saloon', null, 12.8779361, 77.6385812, null, null, null),
  ('salon', 'Green Trends', null, 12.8789603, 77.637845, null, null, null),
  ('salon', 'Radiance Ladies Beauty Salon & Spa', null, 12.8760221, 77.639765, null, null, null),
  ('salon', 'Retro', null, 12.8919175, 77.6196125, null, null, null),
  ('salon', 'Ziva Spa', '52, Hosur Main Rd, Kudlu Gate, Krishna Reddy Industrial Area, Hosapalaya,, Muneshwara Nagar,, 560068', 12.8898296, 77.6399476, '099102 48203', 'hotelekaa.com', '09:00-22:00'),
  ('restaurant', 'Cafe Baha', null, 12.8736761, 77.6112921, null, null, null),
  ('restaurant', 'Cane Corner', 'Manipal County Road', 12.8738696, 77.6424281, null, null, null),
  ('restaurant', 'Dosa Kuteera', null, 12.8889281, 77.6259852, null, null, 'Mo-Su 08:00-12:00,18:00-22:00; Sa; PH open'),
  ('restaurant', 'Dwarka Bhavan', null, 12.8773579, 77.6389209, null, null, 'Mo-Fr 05:30-22:30; PH open'),
  ('restaurant', 'Illam Resturant', 'Opp. Royal Height Apartment, Manipal County Road, 560068', 12.8759565, 77.6397754, null, null, 'Mo-Su 09:00-22:00'),
  ('restaurant', 'iSiri Cafe', null, 12.8832343, 77.6075065, '+9199454 75540', 'http://www.isiricafe.com/', null),
  ('restaurant', 'Jai Maruti 99 Variety Dosa', null, 12.8782186, 77.6381148, null, null, null),
  ('restaurant', 'Magic Oven', null, 12.8777101, 77.6387217, null, null, null),
  ('restaurant', 'Manipal County', null, 12.8737015, 77.6420142, null, null, null),
  ('restaurant', 'Nandanam', null, 12.876884, 77.6392801, '7338446609', null, 'Mo-Su 08:00-23:00'),
  ('restaurant', 'NuTy Central Kitchen', '#73/14, Aishwarya Crystal Layout, 560068', 12.8776064, 77.6449397, null, null, null),
  ('restaurant', 'Oye Punjab Resturant', null, 12.8787352, 77.6367386, null, null, null),
  ('restaurant', 'Sri Krishna Grand', null, 12.8743782, 77.6405809, null, null, null),
  ('restaurant', 'Udupi Upahar', 'Hosur Road', 12.8901826, 77.6397297, null, null, null),
  ('gym', 'cult.fit', '1st-2nd Floor, DLF Main Road, 560076', 12.8763561, 77.6139619, null, null, null),
  ('bank', 'Andhra Bank', 'Begur - Hulimavu Road, 560076', 12.876223, 77.6133183, null, 'https://www.andhrabank.in', null),
  ('bank', 'Axis Bank', null, 12.8743888, 77.6405192, null, null, null),
  ('bank', 'Canara Bank', null, 12.8777704, 77.6386842, null, null, null),
  ('bank', 'Central Bank', null, 12.8784346, 77.6035728, null, null, null),
  ('bank', 'Central Bank & ATM', null, 12.8797542, 77.6039308, null, null, null),
  ('bank', 'Corporation Bank', null, 12.8758604, 77.6169923, null, null, null),
  ('bank', 'ICICI Bank', null, 12.8746789, 77.6401603, null, null, null),
  ('bank', 'IDBI Bank', null, 12.889924, 77.638912, null, null, null),
  ('bank', 'Karnataka Bank', null, 12.8628669, 77.6148979, null, null, null),
  ('bank', 'National Co-operative Bank Ltd.', null, 12.8896145, 77.639937, null, null, null),
  ('bank', 'South Indian Bank', null, 12.8832789, 77.6074429, null, null, null),
  ('bank', 'State Bank of India', null, 12.8754555, 77.6483068, null, null, null),
  ('petrol', 'HP', null, 12.8770005, 77.6478369, null, null, null),
  ('petrol', 'Indian Oil', null, 12.8853599, 77.6417564, null, null, null),
  ('worship', 'Infant Jesus Church Hongasandra', null, 12.8900232, 77.6250769, null, null, null),
  ('worship', 'Sai Baba Temple', null, 12.8763595, 77.6026806, null, null, null),
  ('worship', 'Sri Rama Temple Hulimavu', null, 12.8779083, 77.6025132, null, null, null),
  ('worship', 'Sri Sri Sri Patalamma Temple', null, 12.8771451, 77.6466294, null, null, null),
  ('worship', 'Vinayaka Temple', '5th Cross Road', 12.8826477, 77.6413709, null, null, null)
) as v(place_type, name, address, lat, lng, phone, website, hours)
where (select id from seeder) is not null
  and not exists (
    select 1 from public.places p
    where p.community_id = 'd836e935-4622-4289-8136-11ca73b54a39' and lower(p.name) = lower(v.name)
  );
