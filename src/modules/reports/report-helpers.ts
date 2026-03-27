import { Types } from 'mongoose';
import { ReportQueryDto } from './dto/report-query.dto';

export const toObjectId = (value?: string) =>
  value ? new Types.ObjectId(value) : undefined;

export const roundCurrency = (value: number) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const buildDateRange = (query: ReportQueryDto) => {
  if (query.billingYear && query.billingMonth) {
    const from = new Date(query.billingYear, query.billingMonth - 1, 1);
    const to = new Date(query.billingYear, query.billingMonth, 0, 23, 59, 59, 999);
    return { from, to };
  }

  if (query.billingYear) {
    const from = new Date(query.billingYear, 0, 1);
    const to = new Date(query.billingYear, 11, 31, 23, 59, 59, 999);
    return { from, to };
  }

  if (query.dateFrom || query.dateTo) {
    const from = query.dateFrom ? new Date(query.dateFrom) : new Date('2000-01-01');
    const to = query.dateTo ? new Date(query.dateTo) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  return null;
};

export const getTenantFullName = (tenant: any) => {
  if (!tenant || typeof tenant === 'string') return '-';
  return `${tenant.personalInfo?.firstName || ''} ${tenant.personalInfo?.lastName || ''}`.trim() || '-';
};

export const getBuildingSummary = (building: any) => {
  if (!building || typeof building === 'string') return null;
  return {
    _id: String(building._id),
    name: building.name,
    code: building.code,
  };
};

export const getUnitSummary = (unit: any) => {
  if (!unit || typeof unit === 'string') return null;
  return {
    _id: String(unit._id),
    unitNumber: unit.unitNumber,
    code: unit.code,
    type: unit.type,
  };
};

export const getLeaseSummary = (lease: any) => {
  if (!lease || typeof lease === 'string') return null;
  return {
    _id: String(lease._id),
    leaseNumber: lease.leaseNumber,
    status: lease.status,
    rentAmount: lease.terms?.rentAmount || 0,
  };
};

export const getTenantSummary = (tenant: any) => {
  if (!tenant || typeof tenant === 'string') return null;
  return {
    _id: String(tenant._id),
    tenantCode: tenant.tenantCode,
    fullName: getTenantFullName(tenant),
    phone: tenant.contact?.primaryPhone || null,
    email: tenant.contact?.email || null,
  };
};
