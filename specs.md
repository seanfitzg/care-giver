# care-giver specifications

care-giver is an application for anyone who requires full-time care — a child, an adult with serious disabilities, or an elderly person. The person receiving care may have complex medical needs such as scheduled medications and assisted feeding (e.g. via PEG), or simpler routines that still require consistent monitoring across a team of carers.

## What is required

An application that records care events and reminds carers of the care recipient's needs throughout the day.

- The care recipient may need medication at certain times of the day. Remind the carer that this needs to occur.
- The care recipient may need to be fed at scheduled intervals. Remind the carer that this needs to occur.
- The carer needs to be able to enter care events into a UI.
- The UI needs to run on iOS and Android devices.
- The UI needs to be accessible on a dedicated web page designed for desktop browsers — not just a mobile app ported to web.
- Multiple carers need to be able to access the care recipient's needs.
- When a feed is given, rest intervals between boluses need to be enforced (e.g. 20 or 25 minute breaks).
- Other activities need to be scheduled as well (e.g. stander time, physiotherapy).
- This needs to work on iPhone, Android, and iPad.

## Platform decisions

**Mobile app**: React Native + Expo, targeting iPhone, Android, and iPad. Carers use this on the go during a shift.

**Web app**: Separate Next.js application sharing the same Supabase backend. Designed for desktop browsers — better suited to admin tasks like managing the schedule, reviewing the full care history, and managing the carer team.

Both clients connect to the same Supabase project (Postgres + Auth + Realtime + Edge Functions) and enforce the same role-based access rules.
