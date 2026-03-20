## Problem

The step indicator dots below the slider don't align with the actual slider stop positions. This is because the range input thumb is 64px wide (`w-16`), so the thumb's center doesn't travel the full width of the track — it's inset by half the thumb width (32px) on each side. The dots currently use `mx-2` (8px inset), which doesn't account for this.

what i need the thumb area of the center excet below i want to that dot that dot are have a stop point every stop point user drag the slider the slider thumb stop on that dot point and the mb must be have a area of the center point the dot center in horizontal straight line 

## Fix

**File: `src/pages/SearchOrders.tsx` (lines 768-777)**

Update the dot container's horizontal margin to match the actual thumb travel range:

- The track is inset by `left-2 right-2` (8px each side)
- The thumb center travels from `8px + 32px = 40px` to `width - 40px`
- Change the dot container from `mx-2` to use `left` and `right` values of `calc(8px + 32px)` = 40px, matching the thumb's travel endpoints

This ensures all 5 dots sit exactly under the 5 positions where the thumb actually stops.