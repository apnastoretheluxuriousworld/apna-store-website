-- "The Film Room" homepage section is now "Our Feed" (vertical 9:16 videos, Admin → Feed).
UPDATE "homepage_sections" SET "title" = 'Our Feed' WHERE "type" = 'reels' AND "title" = 'The Film Room';
