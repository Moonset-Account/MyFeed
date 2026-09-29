import { useEffect, useMemo, useState } from 'react';
import type { Bill, LedgerState, SplitType } from '../types';
import { newId, today } from '../store';
import { parseYuan } from '../lib/money';
import { splitEqual, splitByRatio, splitFixed } from '../lib/split';

const CATEGORIES = ['房租', '水电', '采购', '网费', '燃气', '其他'];

interface Props {
  state: LedgerState;
  setState: React.Dispatch<React.SetStateAction<LedgerState>>;
  editing: Bill | null;
  onDone: () => void;
}

export function BillForm({ state, setState, editing, onDone }: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('');
  const [payerId, setPayerId] = useState('');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [selected, setSelected] = useState<string[]>([]);
  const [ratioInputs, setRatioInputs] = useState<Record<string, string>>({});
  const [fixedInputs, setFixedInputs] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  // 进入编辑模式时回填表单；保存后由父组件清掉 editing，触发重置。
  useEffect(() => {
    if (!editing) {
      setTitle('');
      setCategory(CATEGORIES[0]);
      setDate(today());
      setAmount('');
      setPayerId(state.members[0]?.id ?? '');
      setSplitType('equal');
      setSelected(state.members.map((m) => m.id));
      setRatioInputs({});
      setFixedInputs({});
      setNote('');
      setError('');
      return;
    }
    setTitle(editing.title);
    setCategory(editing.category);
    setDate(editing.date);
    setAmount((editing.totalCents / 100).toFixed(2));
    setPayerId(editing.payerId);
    setSplitType(editing.splitType);
    setSelected(
      editing.splitType === 'equal' ? editing.participantIds : editing.shares.map((s) => s.memberId),
    );
    setRatioInputs(
      Object.fromEntries(editing.ratios.map((r) => [r.memberId, String(r.weight)])),
    );
    setFixedInputs(
      Object.fromEntries(editing.shares.map((s) => [s.memberId, (s.amount / 100).toFixed(2)])),
    );
    setNote(editing.note);
    setError('');
  }, [editing, state.members]);

  const totalCents = useMemo(() => parseYuan(amount), [amount]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = () => {
    setError('');
    if (!title.trim()) return setError('请填写账单标题');
    if (totalCents === null || totalCents <= 0) return setError('请输入正确的金额（最多两位小数）');
    if (!payerId) return setError('请选择付款人');
    if (!date) return setError('请选择日期');
    const participants = selected.filter((id) => state.members.some((m) => m.id === id));
    if (participants.length === 0) return setError('请至少选择一名分摊成员');

    let shares;
    let ratios: Bill['ratios'] = [];
    try {
      if (splitType === 'equal') {
        shares = splitEqual(totalCents, participants);
      } else if (splitType === 'ratio') {
        ratios = participants.map((id) => {
          const w = Number(ratioInputs[id] ?? '1');
          return { memberId: id, weight: w };
        });
        shares = splitByRatio(totalCents, ratios);
      } else {
        const amounts = participants.map((id) => {
          const cents = parseYuan(fixedInputs[id] ?? '');
          if (cents === null) throw new Error('指定金额中存在无效数字');
          return { memberId: id, amount: cents };
        });
        shares = splitFixed(totalCents, amounts);
      }
    } catch (e) {
      return setError((e as Error).message);
    }

    setState((s) => {
      if (editing) {
        // 修改后重新计算：用新的分摊结果整体替换旧账单。
        return {
          ...s,
          bills: s.bills.map((b) =>
            b.id === editing.id
              ? {
                  ...b,
                  title: title.trim(),
                  category,
                  date,
                  totalCents,
                  payerId,
                  splitType,
                  participantIds: participants,
                  ratios,
                  shares,
                  note: note.trim(),
                  updatedAt: Date.now(),
                }
              : b,
          ),
        };
      }
      const bill: Bill = {
        id: newId(),
        title: title.trim(),
        category,
        date,
        totalCents,
        payerId,
        splitType,
        participantIds: participants,
        ratios,
        shares,
        note: note.trim(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return { ...s, bills: [...s.bills, bill] };
    });
    onDone();
  };

  return (
    <section className="card">
      <h2>{editing ? '修改账单（保存后自动重新计算）' : '记一笔'}</h2>
      <div className="grid">
        <label>
          标题
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如：9月房租" />
        </label>
        <label>
          分类
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          日期
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label>
          金额（元）
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" inputMode="decimal" />
        </label>
        <label>
          付款人
          <select value={payerId} onChange={(e) => setPayerId(e.target.value)}>
            {state.members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          分摊方式
          <select value={splitType} onChange={(e) => setSplitType(e.target.value as SplitType)}>
            <option value="equal">人均</option>
            <option value="ratio">固定比例</option>
            <option value="fixed">指定金额</option>
          </select>
        </label>
      </div>

      <fieldset>
        <legend>参与分摊的成员</legend>
        <div className="chips">
          {state.members.map((m) => (
            <label key={m.id} className="chip">
              <input type="checkbox" checked={selected.includes(m.id)} onChange={() => toggle(m.id)} />
              {m.name}
            </label>
          ))}
        </div>
        {splitType === 'ratio' && (
          <div className="split-inputs">
            {selected.map((id) => (
              <label key={id}>
                {state.members.find((m) => m.id === id)?.name} 比例
                <input
                  value={ratioInputs[id] ?? '1'}
                  onChange={(e) => setRatioInputs((r) => ({ ...r, [id]: e.target.value }))}
                  inputMode="decimal"
                />
              </label>
            ))}
          </div>
        )}
        {splitType === 'fixed' && (
          <div className="split-inputs">
            {selected.map((id) => (
              <label key={id}>
                {state.members.find((m) => m.id === id)?.name} 金额（元）
                <input
                  value={fixedInputs[id] ?? ''}
                  onChange={(e) => setFixedInputs((r) => ({ ...r, [id]: e.target.value }))}
                  placeholder="0.00"
                  inputMode="decimal"
                />
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <label>
        备注
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button onClick={submit}>{editing ? '保存并重新计算' : '保存账单'}</button>
        {editing && (
          <button className="secondary" onClick={onDone}>
            取消修改
          </button>
        )}
      </div>
    </section>
  );
}
