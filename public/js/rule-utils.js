/* eslint-disable no-unused-vars */
const RuleUtils = (() => {
  const SANCTION_FILTERS = [
    { id: 'all', label: 'Tutte' },
    { id: 'warn', label: 'WARN' },
    { id: 'ban24', label: 'BAN 24H' },
    { id: 'ban48', label: 'BAN 48H' },
    { id: 'banlong', label: 'BAN 3-7 GG' },
    { id: 'permaban', label: 'PERMABAN' },
    { id: 'other', label: 'Altro' },
  ];

  function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function flattenRules(data) {
    if (!data?.sections) return [];
    const rows = [];
    data.sections.forEach((section, si) => {
      (section.rules || []).forEach((rule, ri) => {
        rows.push({ rule, section, si, ri });
      });
    });
    return rows;
  }

  function findRuleByCode(data, code) {
    const q = String(code || '').trim().toLowerCase();
    if (!q) return null;

    const all = flattenRules(data);
    const exact = all.find(({ rule }) => rule.code.toLowerCase() === q);
    if (exact) return exact;

    const partial = all.filter(({ rule }) => {
      const c = rule.code.toLowerCase();
      return c.includes(q) || q.split(/[\s+]+/).every((part) => c.includes(part));
    });
    return partial[0] || null;
  }

  function sanctionBlob(rule) {
    return [...(rule.sanctions || []), rule.recidiva || ''].join(' ').toUpperCase();
  }

  function getSanctionTypes(rule) {
    const text = sanctionBlob(rule);
    const types = new Set();

    if (text.includes('WARN')) types.add('warn');
    if (text.includes('PERMABAN') || text.includes('PERMA BAN')) types.add('permaban');
    if (text.includes('48H')) types.add('ban48');
    else if (text.includes('24H')) types.add('ban24');
    if (/BAN\s*(3|7)\s*(-|\s*)?GG/i.test(text) || text.includes('7 GG') || text.includes('3 GG')) {
      types.add('banlong');
    }

    if (!types.size || (types.size === 1 && types.has('warn') && text.includes('ANNULL'))) {
      types.add('other');
    }
    if (text.includes('ANNULL') || text.includes('RICHIAMO') || text.includes('WIPE') || text.includes('AZIONE')) {
      types.add('other');
    }

    return types;
  }

  function matchesSanctionFilter(rule, filterId) {
    if (!filterId || filterId === 'all') return true;
    return getSanctionTypes(rule).has(filterId);
  }

  function matchesSectionFilter(sectionIndex, filterSection) {
    if (filterSection === '' || filterSection === 'all') return true;
    return String(sectionIndex) === String(filterSection);
  }

  function matchesSearchQuery(rule, section, q) {
    if (!q) return true;
    const hay = [
      rule.code,
      rule.name,
      rule.desc,
      ...(rule.sanctions || []),
      rule.recidiva,
      section?.title,
      section?.num,
    ]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  }

  function matchesFilters(rule, section, si, filters) {
    const q = (filters.query || '').trim().toLowerCase();
    if (!matchesSearchQuery(rule, section, q)) return false;
    if (!matchesSectionFilter(si, filters.section)) return false;
    if (!matchesSanctionFilter(rule, filters.sanction)) return false;
    return true;
  }

  function countMatches(data, filters) {
    const q = (filters.query || '').trim().toLowerCase();
    if (!q && filters.section === 'all' && filters.sanction === 'all') return null;
    return flattenRules(data).filter(({ rule, section, si }) => matchesFilters(rule, section, si, filters)).length;
  }

  function parseOffenseNumber(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }

  function extractArrowSanction(recidiva) {
    const match = String(recidiva).match(/→\s*(.+)$/i);
    return match ? match[1].trim() : null;
  }

  function findProgressiveAlert(section) {
    return (section?.alerts || []).find((alert) => {
      const body = `${alert.title} ${alert.body}`.toLowerCase();
      return body.includes('progress') || body.includes('+72') || body.includes('recidiva');
    });
  }

  function calculateSanction(rule, section, offenseInput) {
    const level = parseOffenseNumber(offenseInput);
    const sanctions = rule.sanctions || [];
    const recidiva = rule.recidiva || '—';
    const alert = findProgressiveAlert(section);

    if (sanctions.length === 1 && (sanctions[0].toUpperCase().includes('PERMA') || /irrevocab/i.test(recidiva))) {
      return {
        level,
        sanction: sanctions[0],
        source: 'Sanzione base',
        note: recidiva !== '—' ? recidiva : 'Sempre applicabile',
        next: null,
      };
    }

    if (level <= sanctions.length) {
      const next = level < sanctions.length ? sanctions[level] : extractArrowSanction(recidiva) || recidiva;
      return {
        level,
        sanction: sanctions[level - 1],
        source: `Infrazione ${level}ª`,
        note: sanctions.length > 1 ? `Progressione interna: ${sanctions.join(' → ')}` : null,
        next: next && next !== '—' ? next : null,
      };
    }

    const arrow = extractArrowSanction(recidiva);
    if (arrow && level >= 3) {
      return {
        level,
        sanction: arrow,
        source: 'Recidiva',
        note: recidiva,
        next: null,
      };
    }

    if (level === 2 && recidiva && recidiva !== '—' && !recidiva.includes('→')) {
      return {
        level,
        sanction: recidiva,
        source: 'Recidiva',
        note: 'Seconda infrazione',
        next: null,
      };
    }

    if (alert) {
      if (level === 1) {
        return {
          level,
          sanction: sanctions[0] || 'WARN 1°',
          source: 'Prima infrazione',
          note: alert.body,
          next: sanctions[1] || '48H',
        };
      }
      if (level === 2) {
        return {
          level,
          sanction: sanctions[1] || sanctions[sanctions.length - 1] || 'BAN 48H',
          source: 'Alert sezione',
          note: alert.body,
          next: '+72h sulla precedente',
        };
      }
      return {
        level,
        sanction: `+72h sulla sanzione precedente`,
        source: 'Progressione alert',
        note: alert.body,
        next: null,
      };
    }

    if (recidiva && recidiva !== '—') {
      return {
        level,
        sanction: recidiva,
        source: 'Recidiva',
        note: 'Verifica nel manuale prima di applicare',
        next: null,
      };
    }

    return {
      level,
      sanction: sanctions[sanctions.length - 1] || '—',
      source: 'Default',
      note: 'Nessuna progressione definita — consulta il senior staff',
      next: null,
    };
  }

  return {
    SANCTION_FILTERS,
    flattenRules,
    findRuleByCode,
    getSanctionTypes,
    matchesFilters,
    countMatches,
    calculateSanction,
    escapeRegex,
  };
})();

if (typeof module !== 'undefined') module.exports = RuleUtils;
