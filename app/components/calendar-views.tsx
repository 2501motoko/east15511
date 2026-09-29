"use client";

import { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Dumbbell, Pencil, Plus, Trash2 } from "lucide-react";

export type DutySchedule = { weekday: number; username: string };
export type DutyCheck = { id: string; date: string; garbageDone: boolean; sweepDone: boolean };
export type SportLog = { id: string; activityType: string | null; durationMinutes: number | null; date: string; isPublic: number; ownerId: string; owner: string };
export type SportMember = { id: string; displayName: string; role: "admin" | "member" };
export type AccountOption = { studentId: string; username: string; role: "admin" | "member" };

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const colorPalette = [
  { ink: "#5367d5", soft: "#edf0ff" },
  { ink: "#c46548", soft: "#fff0e9" },
  { ink: "#328473", soft: "#e9f5f1" },
  { ink: "#8b62ae", soft: "#f3edfa" },
];

export function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function makeMonthCells(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => `${year}-${String(monthNumber).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`)];
  while (cells.length % 7) cells.push(null);
  return cells;
}

function dateHeading(date: string) {
  const [, month, day] = date.split("-").map(Number);
  return `${month}月${day}日`;
}

function weekIndex(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function MonthHeader({ month, onMonthChange, onSelectDate }: { month: string; onMonthChange: (month: string) => void; onSelectDate: (date: string) => void }) {
  const selectMonth = (next: string) => { onMonthChange(next); onSelectDate(`${next}-01`); };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  return <div className="month-toolbar"><div><p className="eyebrow">SHARED CALENDAR</p><h3>{month.replace("-", "年")}月</h3></div><div className="month-controls"><button aria-label="上个月" onClick={() => selectMonth(shiftMonth(month, -1))}><ChevronLeft size={18}/></button><button className="month-today" onClick={() => { onMonthChange(today.slice(0, 7)); onSelectDate(today); }}>今天</button><button aria-label="下个月" onClick={() => selectMonth(shiftMonth(month, 1))}><ChevronRight size={18}/></button></div></div>;
}

export function DutyCalendarView({ month, selectedDate, schedules, duties, accounts, canInteract, onMonthChange, onSelectDate, onToggle, onSaveSchedule, onDeleteSchedule }: {
  month: string; selectedDate: string; schedules: DutySchedule[]; duties: DutyCheck[]; accounts: AccountOption[]; canInteract: boolean;
  onMonthChange: (month: string) => void; onSelectDate: (date: string) => void;
  onToggle: (date: string, field: "garbage" | "sweep", done: boolean) => void;
  onSaveSchedule: (weekday: number, username: string) => void; onDeleteSchedule: (weekday: number) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [weekday, setWeekday] = useState(1);
  const [username, setUsername] = useState("");
  const days = makeMonthCells(month);
  const selectedSchedule = schedules.find((item) => item.weekday === weekIndex(selectedDate));
  const selectedDuty = duties.find((item) => item.date === selectedDate);
  const namesByWeekday = new Map(schedules.map((item) => [item.weekday, item.username]));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  const startEditing = (item?: DutySchedule) => {
    setWeekday(item?.weekday ?? weekIndex(selectedDate));
    setUsername(item?.username ?? accounts[0]?.username ?? "");
    setFormOpen(true);
  };

  return <div className="calendar-layout duty-calendar-layout">
    <section className="panel month-panel">
      <div className="duty-calendar-heading"><MonthHeader month={month} onMonthChange={onMonthChange} onSelectDate={onSelectDate}/>{canInteract && <button className="secondary-button" onClick={() => startEditing()}><Plus size={15}/>新增排班</button>}</div>
      <div className="calendar-grid duty-month-grid"><div className="calendar-weekdays">{weekdayNames.map((name) => <span key={name}>{name}</span>)}</div><div className="calendar-cells">
        {days.map((date, index) => {
          const schedule = date ? namesByWeekday.get(weekIndex(date)) : undefined;
          const duty = date ? duties.find((item) => item.date === date) : undefined;
          const done = Number(!!duty?.sweepDone) + Number(!!duty?.garbageDone);
          return <div key={`${date ?? "empty"}-${index}`} className={`calendar-cell duty-calendar-cell ${!date ? "calendar-cell-empty" : ""} ${date === selectedDate ? "cell-selected" : ""} ${date === today ? "cell-today" : ""}`}>
            {date && <button className="duty-date-select" onClick={() => onSelectDate(date)}><span>{Number(date.slice(-2))}</span></button>}
            {date && schedule && <button className="duty-calendar-name" title={`${schedule} 值日`} onClick={() => onSelectDate(date)}>{schedule}</button>}
            {date && <div className="duty-cell-status" aria-label={`${done}/2 项完成`}>{[duty?.sweepDone, duty?.garbageDone].map((checked, task) => <i key={task} className={checked ? "done" : ""}/>)}</div>}
          </div>;
        })}
      </div></div>
      <div className="calendar-legend"><span><i className="legend-duty"/>当日负责人</span><span><i className="legend-duty-done"/>已打卡</span><span className="legend-note">点选日期查看并打卡</span></div>
      <div className="weekly-schedule-list"><b>每周排班</b>{schedules.length ? schedules.slice().sort((a, b) => a.weekday - b.weekday).map((item) => <div className="weekly-schedule-row" key={item.weekday}><span>{weekdayNames[item.weekday]}</span><strong>{item.username}</strong>{canInteract && <><button aria-label={`修改${weekdayNames[item.weekday]}排班`} onClick={() => startEditing(item)}><Pencil size={14}/></button><button aria-label={`删除${weekdayNames[item.weekday]}排班`} onClick={() => onDeleteSchedule(item.weekday)}><Trash2 size={14}/></button></>}</div>) : <small className="schedule-empty">还没有固定排班。添加后会按周重复。</small>}</div>
    </section>
    <section className="panel agenda-panel duty-agenda-panel">
      <div className="panel-head"><div><p className="eyebrow">DAILY DUTY</p><h3>{dateHeading(selectedDate)} <small>{weekdayNames[weekIndex(selectedDate)]}</small></h3></div><span className="agenda-count">{selectedDuty?.sweepDone && selectedDuty?.garbageDone ? "已完成" : "值日"}</span></div>
      <div className="duty-assignee-card"><span className="duty-assignee-avatar">{selectedSchedule?.username.slice(0, 1) ?? "?"}</span><div><small>当日负责人</small><b>{selectedSchedule?.username ?? "未安排"}</b></div>{canInteract && selectedSchedule && <button aria-label="编辑本周排班" onClick={() => startEditing(selectedSchedule)}><Pencil size={14}/></button>}</div>
      <p className="duty-action-label">点一下完成打卡，再点可撤销</p>
      <button disabled={!canInteract} className={`duty-checkin-row ${selectedDuty?.sweepDone ? "is-done" : ""}`} onClick={() => onToggle(selectedDate, "sweep", !selectedDuty?.sweepDone)}><span className="duty-check-icon">{selectedDuty?.sweepDone ? <Check size={16}/> : null}</span><span><b>扫地打卡</b><small>{selectedDuty?.sweepDone ? "已完成" : "点击即打卡"}</small></span><ChevronRight size={16}/></button>
      <button disabled={!canInteract} className={`duty-checkin-row ${selectedDuty?.garbageDone ? "is-done" : ""}`} onClick={() => onToggle(selectedDate, "garbage", !selectedDuty?.garbageDone)}><span className="duty-check-icon">{selectedDuty?.garbageDone ? <Check size={16}/> : null}</span><span><b>倒垃圾打卡</b><small>{selectedDuty?.garbageDone ? "已完成" : "点击即打卡"}</small></span><ChevronRight size={16}/></button>
      {!selectedSchedule && canInteract && <div className="duty-rule-prompt">这一天还没有负责人。<button className="text-button" onClick={() => startEditing()}>添加值日安排</button></div>}
      {formOpen && <form className="duty-rule-form" onSubmit={(event) => { event.preventDefault(); if (!username) return; onSaveSchedule(weekday, username); setFormOpen(false); }}><div><b>设置每周值日</b><button type="button" aria-label="关闭" onClick={() => setFormOpen(false)}>×</button></div><label>每周星期<select value={weekday} onChange={(event) => setWeekday(Number(event.target.value))}>{weekdayNames.map((name, index) => <option key={name} value={index}>{name}</option>)}</select></label><label>负责人<select value={username} onChange={(event) => setUsername(event.target.value)} required>{accounts.map((account) => <option key={account.studentId} value={account.username}>{account.username}</option>)}</select></label><button className="primary-button" disabled={!accounts.length}>保存排班</button></form>}
      <div className="duty-note">扫地与倒垃圾分别打卡；所有成员都可以登记或撤销。</div>
    </section>
  </div>;
}

function sportColor(username: string) {
  const assigned: Record<string, number> = { 王为钧: 0, 赵英: 1, 刘佳: 2, 谢俞淇: 3 };
  if (assigned[username] !== undefined) return colorPalette[assigned[username]];
  let hash = 0;
  for (const char of username) hash = (hash * 31 + char.codePointAt(0)!) >>> 0;
  return colorPalette[hash % colorPalette.length];
}

export function SportCalendarView({ month, selectedDate, sports, accounts, canInteract, memberId, role, onMonthChange, onSelectDate, onCreate, onEdit, onDelete }: {
  month: string; selectedDate: string; sports: SportLog[]; accounts: AccountOption[]; canInteract: boolean; memberId: string; role: "admin" | "member" | "guest";
  onMonthChange: (month: string) => void; onSelectDate: (date: string) => void;
  onCreate: (fields: { date: string; activityType: string; durationMinutes: number | null; isPublic: boolean }) => void;
  onEdit: (sport: SportLog) => void; onDelete: (sport: SportLog) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [focusedOwner, setFocusedOwner] = useState("");
  const visibleAccounts = accounts;
  const accountNames = visibleAccounts.map((account) => account.username);
  const otherNames = [...new Set(sports.map((sport) => sport.owner).filter((name) => !accountNames.includes(name)))].sort();
  const lanes = [...accountNames, ...otherNames];
  const days = makeMonthCells(month);
  const selectedLogs = useMemo(() => sports.filter((sport) => sport.date === selectedDate).sort((a, b) => a.owner.localeCompare(b.owner, "zh-CN")), [sports, selectedDate]);
  const focusedLogs = selectedLogs.filter((sport) => !focusedOwner || sport.owner === focusedOwner);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai" }).format(new Date());
  const selectDate = (date: string) => { onSelectDate(date); setFocusedOwner(""); };

  return <>
    <div className="calendar-layout sport-calendar-layout">
      <section className="panel month-panel sport-month-panel">
        <MonthHeader month={month} onMonthChange={onMonthChange} onSelectDate={selectDate}/>
        <div className="calendar-grid sport-month-grid"><div className="calendar-weekdays">{weekdayNames.map((name) => <span key={name}>{name}</span>)}</div><div className="calendar-cells">
          {days.map((date, index) => {
            const daily = date ? sports.filter((sport) => sport.date === date) : [];
            const grouped = new Map<string, SportLog[]>();
            for (const sport of daily) grouped.set(sport.owner, [...(grouped.get(sport.owner) ?? []), sport]);
            return <div key={`${date ?? "empty"}-${index}`} className={`calendar-cell sport-calendar-cell ${!date ? "calendar-cell-empty" : ""} ${date === selectedDate ? "cell-selected" : ""} ${date === today ? "cell-today" : ""}`}>
              {date && <button className="sport-date-select" onClick={() => selectDate(date)}><span>{Number(date.slice(-2))}</span></button>}
              {date && <div className="sport-lanes">{lanes.map((name) => {
                const logs = grouped.get(name);
                if (!logs?.length) return <span className="sport-lane-empty" key={name}/>;
                const color = sportColor(name);
                const total = logs.reduce((sum, log) => sum + (log.durationMinutes ?? 0), 0);
                return <button key={name} className="sport-calendar-chip" style={{ "--sport-ink": color.ink, "--sport-soft": color.soft } as React.CSSProperties} title={`${name} · ${logs.length} 次运动，${total ? `${total} 分钟` : "时长未填"}`} onClick={() => { onSelectDate(date); setFocusedOwner(name); }}><b>{name}</b><span>{total ? `${total}分` : "打卡"}</span></button>;
              })}</div>}
            </div>;
          })}
        </div></div>
        <div className="sport-color-legend">{lanes.map((name) => { const color = sportColor(name); return <span key={name}><i style={{ background: color.ink }}/>{name}</span>; })}</div>
      </section>
      <section className="panel agenda-panel sport-agenda-panel">
        <div className="panel-head"><div><p className="eyebrow">SPORTS</p><h3>{dateHeading(selectedDate)} <small>{selectedLogs.length} 条记录</small></h3></div>{canInteract && <button className="primary-button sport-quick-add" onClick={() => setFormOpen((open) => !open)}><Plus size={15}/>打卡</button>}</div>
        <p className="sport-date-subtitle">{selectedLogs.length ? "选择一条运动记录查看详情" : "这一天还没有运动记录"}</p>
        {formOpen && <form className="sport-quick-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const rawDuration = String(form.get("duration") ?? ""); onCreate({ date: selectedDate, activityType: String(form.get("activityType") ?? "").trim(), durationMinutes: rawDuration ? Number(rawDuration) : null, isPublic: form.get("isPublic") === "on" }); setFormOpen(false); }}><label>运动类型<input name="activityType" placeholder="例如：跑步（选填）" maxLength={80}/></label><label>时长（分钟）<input name="duration" type="number" min="1" max="1440" placeholder="选填"/></label><label className="sport-public-toggle"><input type="checkbox" name="isPublic" defaultChecked/>全宿舍可见</label><button className="primary-button"><Check size={14}/>完成打卡</button></form>}
        {focusedOwner && <button className="sport-filter-reset" onClick={() => setFocusedOwner("")}>显示当天全部记录</button>}
        <div className="sport-detail-list">{focusedLogs.map((sport) => {
          const color = sportColor(sport.owner);
          const canEdit = sport.ownerId === memberId || role === "admin";
          return <article key={sport.id} className="sport-detail-card" style={{ "--sport-ink": color.ink, "--sport-soft": color.soft } as React.CSSProperties}>
            <button className="sport-detail-main" onClick={() => setFocusedOwner(sport.owner)}><span className="sport-detail-dot"/><span><b>{sport.owner}</b><small>{sport.activityType || "完成一次运动"} · {sport.durationMinutes ? `${sport.durationMinutes} 分钟` : "时长未填"}</small></span></button>
            {canEdit && <div className="sport-detail-actions"><button aria-label="编辑运动记录" onClick={() => onEdit(sport)}><Pencil size={14}/></button><button aria-label="删除运动记录" onClick={() => onDelete(sport)}><Trash2 size={14}/></button></div>}
          </article>;
        })}{!focusedLogs.length && !formOpen && <div className="sport-day-empty"><Dumbbell size={25}/><b>{selectedLogs.length ? "没有这个成员的记录" : "从一次轻松运动开始"}</b><span>打卡后会按成员颜色显示在月历中。</span></div>}</div>
        <div className="sport-calendar-note">月历色条显示用户名和当日运动时长；点击色条查看详细记录。</div>
      </section>
    </div>
  </>;
}
