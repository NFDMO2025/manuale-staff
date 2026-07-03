window.RuleRegolamentoLinks = (() => {
  const CODE_HINTS = {
    '9.10': 'npc',
    '9.13': 'GANG',
  };

  const EXTRA_REFS = {
    '1.5': [{ section: '1', item: '6' }],
    '1.3 + 2.22': [{ section: '1', item: '4' }, { section: '2', item: '22' }],
    '2.1 + 6.3': [{ section: '6', item: '3' }],
    '2.1 + 6.2': [{ section: '6', item: '2' }],
  };

  function parseCodes(codeStr) {
    if (!codeStr) return [];
    return [...new Set(String(codeStr).match(/\d+\.\d+/g) || [])];
  }

  function findSectionIndex(regolamento, sectionNum) {
    if (!regolamento?.sections) return -1;
    return regolamento.sections.findIndex((s) => String(s.num) === String(sectionNum));
  }

  function findItemIndex(section, itemNum, hint) {
    if (!section?.items?.length) return -1;
    const matches = section.items
      .map((item, ii) => ({ item, ii }))
      .filter(({ item }) => String(item.num) === String(itemNum));

    if (!matches.length) return -1;
    if (matches.length === 1) return matches[0].ii;

    if (hint) {
      const hinted = matches.find(({ item }) => item.text.toLowerCase().includes(hint.toLowerCase()));
      if (hinted) return hinted.ii;
    }

    const substantive = matches.find(({ item }) => item.text.length > 40);
    return (substantive || matches[0]).ii;
  }

  function resolveRef(regolamento, sectionNum, itemNum, hint) {
    const si = findSectionIndex(regolamento, sectionNum);
    if (si < 0) return null;
    const section = regolamento.sections[si];
    const ii = findItemIndex(section, itemNum, hint);
    if (ii < 0) return null;

    const item = section.items[ii];
    return {
      si,
      ii,
      sectionNum: String(section.num),
      sectionTitle: section.title,
      itemNum: String(item.num || itemNum),
      text: item.text,
      label: `${section.num}.${item.num || itemNum} — ${section.title}`,
    };
  }

  function refsFromCodes(codes, regolamento) {
    const links = [];
    const seen = new Set();

    codes.forEach((code) => {
      const [sectionNum, itemNum] = code.split('.');
      const hint = CODE_HINTS[code];
      const link = resolveRef(regolamento, sectionNum, itemNum, hint);
      if (link && !seen.has(`${link.si}-${link.ii}`)) {
        seen.add(`${link.si}-${link.ii}`);
        links.push(link);
      }
    });

    return links;
  }

  function getLinksForRule(rule, regolamento) {
    if (!rule || !regolamento) return [];

    const codeKey = String(rule.code || '').trim();
    const codes = parseCodes(codeKey);
    const links = refsFromCodes(codes, regolamento);

    const extras = EXTRA_REFS[codeKey] || [];
    extras.forEach((ref) => {
      const hint = CODE_HINTS[`${ref.section}.${ref.item}`];
      const link = resolveRef(regolamento, ref.section, ref.item, hint);
      if (link && !links.some((l) => l.si === link.si && l.ii === link.ii)) {
        links.push(link);
      }
    });

    return links.sort((a, b) => {
      const sec = Number(a.sectionNum) - Number(b.sectionNum);
      if (sec !== 0) return sec;
      return Number(a.itemNum) - Number(b.itemNum);
    });
  }

  function previewText(text, max = 120) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (clean.length <= max) return clean;
    return `${clean.slice(0, max - 1)}…`;
  }

  return {
    getLinksForRule,
    previewText,
  };
})();
