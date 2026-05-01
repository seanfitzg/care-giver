# care-giver specifications

I am a parent that cares for a child with serious and complicated medical needs. He receives medicine at certain times during the day. His food and water is fed through a PEG.

## What is required

I need an application that can record and remind carers of his needs throughout the day.

- He needs medication at certain times of the day. Remind the carer that this needs to occur.
- He needs to be fed 3 times a day. Remind the carer that this needs to occur.
- The carer needs to be able to enter his needs into a UI.
- The UI needs to run on iOS and Android devices.
- The UI needs to be accessible on a dedicated web page designed for desktop browsers — not just a mobile app ported to web.
- Multiple carers need to be able to access his needs.
- When he is fed, the feed needs to be given with 20 or 25 minute breaks between each feed.
- Other things need to be scheduled as well. Stander time, etc.
- This needs to work on iPhone, Android, and iPad.

## Platform decisions

**Mobile app**: React Native + Expo, targeting iPhone, Android, and iPad. Carers use this on the go during a shift.

**Web app**: Separate Next.js application sharing the same Supabase backend. Designed for desktop browsers — better suited to admin tasks like managing the schedule, reviewing the full care history, and managing the carer team.

Both clients connect to the same Supabase project (Postgres + Auth + Realtime + Edge Functions) and enforce the same role-based access rules.
