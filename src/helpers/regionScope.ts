/**
 * Shared region-scope resolution helpers used across admin controllers.
 *
 * Usage:
 *   import { resolveStaffRegionId, buildRegionFilter } from '../helpers/regionScope';
 */
import mongoose from 'mongoose';
import Region from '../models/config/region.model';

/**
 * Returns the ObjectId of the staff member's assigned region, or null when
 * the staff is a super_admin (unrestricted view).
 *
 * The staff's `region` field may be stored as:
 *   • a valid ObjectId string  → used directly
 *   • a region name string     → looked up in the Region collection
 */
export async function resolveStaffRegionId(
    staff: any
): Promise<mongoose.Types.ObjectId | null> {
    if (!staff) return null;

    const roleName: string = staff.role?.name ?? '';

    // super_admin is never restricted to a single region
    if (roleName === 'super_admin') return null;

    const regionValue: string | undefined = staff.region;
    if (!regionValue) return null;

    if (mongoose.Types.ObjectId.isValid(regionValue)) {
        return new mongoose.Types.ObjectId(regionValue);
    }

    // Try by name (case-insensitive)
    const region = await Region.findOne({
        name: { $regex: new RegExp(`^${regionValue}$`, 'i') }
    }).lean();

    return region ? (region._id as mongoose.Types.ObjectId) : null;
}

/**
 * Appends a `region` restriction to a MongoDB query object when the staff is
 * not a super_admin.  Mutates and returns the query for convenience.
 */
export async function applyRegionFilter(
    query: Record<string, any>,
    staff: any
): Promise<Record<string, any>> {
    const regionId = await resolveStaffRegionId(staff);
    if (regionId) {
        query.region = regionId;
    }
    return query;
}
