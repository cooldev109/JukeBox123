import React, { useEffect, useState } from 'react';
import { Card, Button, Input } from '@jukebox/ui';
import { api } from '../../lib/api';
import { EventConfigEditor } from '../../components/EventConfigEditor';

interface DefaultPricing {
  songPrice: number;
  prioritySongPrice: number;
  defaultCommissionPercent: number;
  currency: string;
  creditTopUpAmounts: number[];
}

interface CommissionSplit {
  platformPercent: number;
  venuePercent: number;
  affiliatePercent: number;
  operatorPercent: number;
}

const DEFAULT_PRICING: DefaultPricing = {
  songPrice: 2.0,
  prioritySongPrice: 5.0,
  defaultCommissionPercent: 30,
  currency: 'BRL',
  creditTopUpAmounts: [10, 20, 50, 100],
};

const DEFAULT_SPLIT: CommissionSplit = {
  platformPercent: 30,
  venuePercent: 30,
  affiliatePercent: 35,
  operatorPercent: 5,
};

export const SettingsPage: React.FC = () => {
  // ── Pricing state ──
  const [pricing, setPricing] = useState<DefaultPricing>(DEFAULT_PRICING);
  const [maxQueueSize, setMaxQueueSize] = useState(50);
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingSaved, setPricingSaved] = useState(false);
  const [pricingError, setPricingError] = useState('');

  // ── Commission split state ──
  const [split, setSplit] = useState<CommissionSplit>(DEFAULT_SPLIT);
  const [splitSaving, setSplitSaving] = useState(false);
  const [splitSaved, setSplitSaved] = useState(false);
  const [splitError, setSplitError] = useState('');

  // ── Load global config ──
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { data } = await api.get('/config/global');
        const dp = data.data?.defaultPricing;
        if (dp) {
          setPricing({
            songPrice: dp.songPrice ?? DEFAULT_PRICING.songPrice,
            prioritySongPrice: dp.prioritySongPrice ?? DEFAULT_PRICING.prioritySongPrice,
            defaultCommissionPercent: dp.defaultCommissionPercent ?? DEFAULT_PRICING.defaultCommissionPercent,
            currency: dp.currency ?? DEFAULT_PRICING.currency,
            creditTopUpAmounts: dp.creditTopUpAmounts ?? DEFAULT_PRICING.creditTopUpAmounts,
          });
        }
      } catch {
        // Use defaults on error
      }
    };

    const loadSplit = async () => {
      try {
        const { data } = await api.get('/config/commission-split');
        const s = data.data?.split;
        if (s) {
          setSplit({
            platformPercent: s.platformPercent ?? DEFAULT_SPLIT.platformPercent,
            venuePercent: s.venuePercent ?? DEFAULT_SPLIT.venuePercent,
            affiliatePercent: s.affiliatePercent ?? DEFAULT_SPLIT.affiliatePercent,
            operatorPercent: s.operatorPercent ?? DEFAULT_SPLIT.operatorPercent,
          });
        }
      } catch {
        // Use defaults on error
      }
    };

    loadConfig();
    loadSplit();
  }, []);

  // ── Save pricing ──
  const handleSavePricing = async () => {
    setPricingSaving(true);
    setPricingError('');
    try {
      await api.put('/config/global', {
        defaultPricing: {
          songPrice: pricing.songPrice,
          prioritySongPrice: pricing.prioritySongPrice,
          defaultCommissionPercent: pricing.defaultCommissionPercent,
          currency: pricing.currency,
          creditTopUpAmounts: pricing.creditTopUpAmounts,
        },
      });
      setPricingSaved(true);
      setTimeout(() => setPricingSaved(false), 2000);
    } catch (err: any) {
      setPricingError(err?.response?.data?.message || 'Failed to save settings');
    } finally {
      setPricingSaving(false);
    }
  };

  // ── Commission split helpers ──
  const splitSum =
    split.platformPercent + split.venuePercent + split.affiliatePercent + split.operatorPercent;
  const splitValid = Math.abs(splitSum - 100) < 0.01;

  const handleSplitChange = (field: keyof CommissionSplit, value: string) => {
    const num = parseFloat(value);
    setSplit((prev) => ({ ...prev, [field]: isNaN(num) ? 0 : num }));
  };

  const handleSaveSplit = async () => {
    if (!splitValid) {
      setSplitError('Percentages must sum to 100%');
      return;
    }
    setSplitSaving(true);
    setSplitError('');
    try {
      await api.put('/config/commission-split', split);
      setSplitSaved(true);
      setTimeout(() => setSplitSaved(false), 2000);
    } catch (err: any) {
      setSplitError(err?.response?.data?.message || 'Failed to save commission split');
    } finally {
      setSplitSaving(false);
    }
  };

  // ── Derived styling for split total ──
  const sumColor = splitValid
    ? 'text-[#00FF00]'
    : splitSum > 100
      ? 'text-[#FF0080]'
      : 'text-[#FFD700]';

  return (
    <div>
      <h2 className="text-2xl font-bold text-[#F5F5F5] mb-6">Global Settings</h2>

      {/* ─── Pricing & General Config ─── */}
      <Card className="p-6 max-w-lg mb-8" hoverable={false}>
        <h3 className="text-lg font-bold text-[#F5F5F5] mb-4">
          Pricing &amp; General
        </h3>
        <div className="space-y-4">
          <Input
            label="Song Price (R$)"
            type="number"
            step="0.01"
            min="0"
            value={String(pricing.songPrice)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPricing({ ...pricing, songPrice: parseFloat(e.target.value) || 0 })
            }
          />
          <Input
            label="Priority Song Price (R$)"
            type="number"
            step="0.01"
            min="0"
            value={String(pricing.prioritySongPrice)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPricing({ ...pricing, prioritySongPrice: parseFloat(e.target.value) || 0 })
            }
          />
          <Input
            label="Default Commission (%)"
            type="number"
            min="0"
            max="100"
            value={String(pricing.defaultCommissionPercent)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPricing({
                ...pricing,
                defaultCommissionPercent: parseFloat(e.target.value) || 0,
              })
            }
          />
          <Input
            label="Currency (ISO 4217)"
            type="text"
            maxLength={3}
            value={pricing.currency}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPricing({ ...pricing, currency: e.target.value.toUpperCase() })
            }
          />

          {pricingError && (
            <p className="text-sm text-[#FF0080]">{pricingError}</p>
          )}

          <Button
            variant="primary"
            fullWidth
            loading={pricingSaving}
            onClick={handleSavePricing}
          >
            {pricingSaved ? 'Saved!' : 'Save Settings'}
          </Button>
        </div>
      </Card>

      {/* ─── Commission Split ─── */}
      <Card className="p-6 max-w-lg" hoverable={false}>
        <h3 className="text-lg font-bold text-[#F5F5F5] mb-1">
          Commission Split (Default)
        </h3>
        <p className="text-sm text-[#B0B0B0] mb-4">
          How revenue is divided across participants. Must total 100%.
        </p>

        <div className="space-y-4">
          <Input
            label="Platform %"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={String(split.platformPercent)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSplitChange('platformPercent', e.target.value)
            }
          />
          <Input
            label="Venue %"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={String(split.venuePercent)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSplitChange('venuePercent', e.target.value)
            }
          />
          <Input
            label="Affiliate %"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={String(split.affiliatePercent)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSplitChange('affiliatePercent', e.target.value)
            }
          />
          <Input
            label="Operator %"
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={String(split.operatorPercent)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              handleSplitChange('operatorPercent', e.target.value)
            }
          />

          {/* Running total */}
          <div className="flex items-center justify-between rounded-lg bg-[#0F0F0F]/60 border border-white/10 px-4 py-3">
            <span className="text-sm font-medium text-[#B0B0B0]">Total</span>
            <span className={`text-lg font-bold ${sumColor}`}>
              {splitSum.toFixed(1)}%
              {splitValid && (
                <span className="ml-2 text-sm font-normal text-[#00FF00]/70">Valid</span>
              )}
              {!splitValid && splitSum > 100 && (
                <span className="ml-2 text-sm font-normal text-[#FF0080]/70">Over by {(splitSum - 100).toFixed(1)}%</span>
              )}
              {!splitValid && splitSum < 100 && (
                <span className="ml-2 text-sm font-normal text-[#FFD700]/70">Under by {(100 - splitSum).toFixed(1)}%</span>
              )}
            </span>
          </div>

          {splitError && (
            <p className="text-sm text-[#FF0080]">{splitError}</p>
          )}

          <Button
            variant="secondary"
            fullWidth
            loading={splitSaving}
            disabled={!splitValid}
            onClick={handleSaveSplit}
          >
            {splitSaved ? 'Saved!' : 'Save Commission Split'}
          </Button>
        </div>
      </Card>

      {/* Special Events Config */}
      <Card className="p-6 max-w-3xl mt-8" hoverable={false}>
        <h3 className="text-lg font-bold text-[#F5F5F5] mb-4">
          Special Events (Global Defaults)
        </h3>
        <EventConfigEditor />
      </Card>
    </div>
  );
};
