import { ItemView, WorkspaceLeaf, Menu } from "obsidian";
import type CalendarPlugin from "../main";
import { CalendarEvent } from "../types";
import { DateTimePickerModal } from "../components/DateTimePicker";

export const VIEW_TYPE_CALENDAR = "calendar-view";

export class CalendarView extends ItemView {
    plugin: CalendarPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: CalendarPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_CALENDAR;
    }

    getDisplayText(): string {
        return "日历事项";
    }

    getIcon(): string {
        return "calendar-days";
    }

    async onOpen(): Promise<void> {
        this.render();
    }

    async onClose(): Promise<void> {
        // 清理
    }

    render(): void {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass("calendar-view");

        this.renderInputArea(container);
        this.renderEventsList(container);
    }

    private renderInputArea(container: HTMLElement): void {
        const inputArea = container.createDiv("calendar-input-area");
        const inputWrapper = inputArea.createDiv("calendar-input-wrapper");
        
        // 状态提示
        const statusHint = inputWrapper.createDiv("calendar-input-hint");
        statusHint.style.display = "none";
        statusHint.style.fontSize = "12px";
        statusHint.style.color = "var(--text-muted)";
        statusHint.style.marginBottom = "8px";
        
        const textarea = inputWrapper.createEl("textarea", {
            cls: "calendar-input",
            attr: {
                placeholder: "添加日历事件...",
                rows: "2"
            }
        });

        const inputActions = inputWrapper.createDiv("calendar-input-actions");

        // 底部工具栏
        const toolbar = inputActions.createDiv("calendar-input-toolbar");
        
        // 日历选择
        const calendarSelect = toolbar.createEl("select", { cls: "calendar-select" });
        calendarSelect.style.fontSize = "12px";
        calendarSelect.style.padding = "4px 8px";
        calendarSelect.style.border = "1px solid var(--background-modifier-border)";
        calendarSelect.style.borderRadius = "4px";
        calendarSelect.style.backgroundColor = "var(--background-primary)";
        calendarSelect.style.color = "var(--text-normal)";
        
        // 加载日历列表
        this.plugin.storage.getCalendars().then((calendars) => {
            calendarSelect.empty();
            calendars.forEach((cal) => {
                const option = calendarSelect.createEl("option", { text: cal, value: cal });
            });
        });

        // 存储选中的时间
        let startTime: Date | null = null;
        let endTime: Date | null = null;
        
        // 设置默认时间（当前时间+1小时）
        const setDefaultTimes = () => {
            const now = new Date();
            startTime = new Date(now);
            startTime.setHours(startTime.getHours() + 1, 0, 0, 0);
            endTime = new Date(startTime);
            endTime.setHours(endTime.getHours() + 1);
        };
        setDefaultTimes();

        // 时间显示区域
        const timeDisplay = inputWrapper.createDiv("calendar-time-display");
        timeDisplay.style.display = "none";
        timeDisplay.style.marginTop = "12px";
        timeDisplay.style.padding = "8px 12px";
        timeDisplay.style.background = "var(--background-secondary)";
        timeDisplay.style.borderRadius = "6px";
        timeDisplay.style.fontSize = "13px";

        const updateTimeDisplay = () => {
            if (startTime && endTime) {
                timeDisplay.style.display = "block";
                timeDisplay.innerHTML = `
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span>📅 ${this.formatDateTime(startTime)} - ${this.formatTime(endTime.toISOString())}</span>
                        <button class="calendar-time-clear" style="padding: 2px 8px; font-size: 12px;">清除</button>
                    </div>
                `;
                const clearBtn = timeDisplay.querySelector('.calendar-time-clear') as HTMLElement;
                clearBtn?.addEventListener('click', () => {
                    startTime = null;
                    endTime = null;
                    timeDisplay.style.display = "none";
                    timeBtn.removeClass('active');
                });
            } else {
                timeDisplay.style.display = "none";
            }
        };

        // 时间按钮 - 点击打开日期选择器，显示日历图标
        const timeBtn = toolbar.createEl("button", { cls: "calendar-toolbar-btn" });
        timeBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>`;
        timeBtn.title = "选择日期时间";
        timeBtn.onclick = () => {
            this.showDateTimePicker(startTime || new Date(), (start, end) => {
                startTime = start;
                endTime = end;
                updateTimeDisplay();
                timeBtn.addClass('active');
            });
        };

        const actionButtons = inputActions.createDiv("calendar-action-buttons");
        actionButtons.style.display = "flex";
        actionButtons.style.gap = "8px";

        const cancelBtn = actionButtons.createEl("button", {
            cls: "calendar-cancel-btn",
            text: "取消编辑"
        });
        cancelBtn.style.display = "none";

        const submitBtn = actionButtons.createEl("button", {
            cls: "calendar-submit-btn",
            text: "添加"
        });

        // 存储当前编辑的事件 ID
        let editingEventId: string | null = null;

        cancelBtn.onclick = () => {
            textarea.value = "";
            startTime = null;
            endTime = null;
            timeDisplay.style.display = "none";
            statusHint.style.display = "none";
            cancelBtn.style.display = "none";
            submitBtn.textContent = "添加";
            textarea.placeholder = "添加日历事件...";
            editingEventId = null;
            timeBtn.removeClass('active');
        };

        submitBtn.onclick = async () => {
            const title = textarea.value.trim();
            if (!title) return;

            const calendar = calendarSelect.value;
            
            if (!startTime || !endTime) {
                new Notice("请设置时间");
                return;
            }

            const startISO = startTime.toISOString();
            const endISO = endTime.toISOString();

            if (editingEventId) {
                // 更新模式
                await this.plugin.storage.updateEvent(editingEventId, title, startISO, endISO);
            } else {
                // 新建模式
                await this.plugin.storage.createEvent(calendar, title, startISO, endISO);
            }

            textarea.value = "";
            startTime = null;
            endTime = null;
            timeDisplay.style.display = "none";
            statusHint.style.display = "none";
            cancelBtn.style.display = "none";
            submitBtn.textContent = "添加";
            textarea.placeholder = "添加日历事件...";
            editingEventId = null;
            timeBtn.removeClass('active');
            
            await this.loadAndRender();
        };

        // 回车提交
        textarea.onkeydown = (e) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitBtn.click();
            } else if (e.key === "Escape" && editingEventId) {
                e.preventDefault();
                cancelBtn.click();
            }
        };

        // 暴露编辑方法供外部调用
        (this as any).startEditEvent = (event: CalendarEvent) => {
            editingEventId = event.id;
            textarea.value = event.title;
            
            startTime = new Date(event.start);
            endTime = new Date(event.end);
            updateTimeDisplay();
            timeBtn.addClass('active');
            
            statusHint.textContent = "Modifying...";
            statusHint.style.display = "block";
            cancelBtn.style.display = "block";
            submitBtn.textContent = "保存";
            textarea.placeholder = "编辑事件内容...";
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            
            // 滚动到顶部
            this.containerEl.scrollTop = 0;
        };
    }

    private showDateTimePicker(initialDate: Date, onSelect: (start: Date, end: Date) => void): void {
        const modal = new DateTimePickerModal({
            initialDate,
            onSelect: (start, end) => {
                onSelect(start, end);
            },
            onClose: () => {
                // cleanup
            },
        });
        
        modal.open();
    }

    private renderEventsList(container: HTMLElement): void {
        const listContainer = container.createDiv("calendar-list-container");
        listContainer.createDiv({ text: "加载中...", cls: "calendar-loading" });

        // 异步加载事件
        this.plugin.storage.getEvents().then(({ events, calendars }) => {
            listContainer.empty();
            this.renderEventsContent(events, calendars, listContainer);
        });
    }

    private async loadAndRender(): Promise<void> {
        const { events, calendars } = await this.plugin.storage.getEvents();
        this.renderEventsContent(events, calendars);
    }

    private renderEventsContent(
        events: Record<string, CalendarEvent[]>,
        calendars: string[],
        container?: HTMLElement
    ): void {
        const listContainer = container || this.containerEl.querySelector(".calendar-list-container") as HTMLElement;
        if (!listContainer) return;

        listContainer.empty();

        const days = this.plugin.storage.groupEventsByDay(events);

        if (days.length === 0) {
            const emptyState = listContainer.createDiv({ cls: "calendar-empty-state" });
            emptyState.createDiv({ text: "📅", cls: "calendar-empty-icon" });
            emptyState.createDiv({ text: "未来3天没有日程", cls: "calendar-empty-title" });
            emptyState.createDiv({ 
                text: "在上方输入框开始添加", 
                cls: "calendar-empty-desc" 
            });
            return;
        }

        days.forEach((day) => {
            this.renderDayGroup(listContainer, day);
        });
    }

    private renderDayGroup(container: HTMLElement, day: {
        dateKey: string;
        label: string;
        events: CalendarEvent[];
    }): void {
        const dayGroup = container.createDiv("calendar-day-group");

        // 日期标题
        const dayHeader = dayGroup.createDiv("calendar-day-header");
        const isToday = day.label === "今天";
        dayHeader.createSpan({ 
            text: day.label, 
            cls: isToday ? "calendar-day-label-today" : "calendar-day-label"
        });
        dayHeader.createSpan({ 
            text: `(${day.events.length})`, 
            cls: "calendar-day-count" 
        });

        // 事件列表
        const eventsList = dayGroup.createDiv("calendar-events-list");
        day.events.forEach((event) => {
            this.renderEventItem(eventsList, event);
        });
    }

    private renderEventItem(container: HTMLElement, event: CalendarEvent): void {
        const item = container.createDiv("calendar-event-item");
        item.dataset.eventId = event.id;

        // 卡片
        const card = item.createDiv("calendar-event-card");

        // 卡片头部
        const cardHeader = card.createDiv("calendar-event-header");
        
        // 时间显示
        const timeEl = cardHeader.createDiv("calendar-event-time");
        if (event.allDay) {
            timeEl.textContent = "全天";
        } else {
            timeEl.textContent = this.formatTime(event.start);
        }
        
        // 日历名称
        const calendarBadge = cardHeader.createDiv("calendar-event-badge");
        calendarBadge.textContent = event.calendar;
        
        const cardActions = cardHeader.createDiv("calendar-event-actions");
        
        const moreBtn = cardActions.createEl("button", { cls: "calendar-more-btn" });
        moreBtn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
        </svg>`;
        moreBtn.title = "更多操作";
        moreBtn.onclick = (e) => {
            e.stopPropagation();
            this.showContextMenu(e, event);
        };

        // 卡片内容
        const cardBody = card.createDiv("calendar-event-body");
        cardBody.createDiv({ text: event.title, cls: "calendar-event-title" });
        
        if (event.notes) {
            const notesEl = cardBody.createDiv({ cls: "calendar-event-meta" });
            notesEl.innerHTML = `📝 ${event.notes}`;
        }

        // 双击进入编辑模式
        cardBody.ondblclick = () => {
            if ((this as any).startEditEvent) {
                (this as any).startEditEvent(event);
            }
        };

        card.oncontextmenu = (e) => {
            e.preventDefault();
            this.showContextMenu(e, event);
        };
    }

    private showContextMenu(e: MouseEvent, event: CalendarEvent): void {
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle("编辑")
                .setIcon("pencil")
                .onClick(() => {
                    if ((this as any).startEditEvent) {
                        (this as any).startEditEvent(event);
                    }
                });
        });

        menu.addItem((item) => {
            item.setTitle("删除")
                .setIcon("trash")
                .onClick(async () => {
                    if (confirm(`确定删除事件"${event.title}"吗？`)) {
                        await this.plugin.storage.deleteEvent(event.id);
                        await this.loadAndRender();
                    }
                });
        });

        menu.showAtMouseEvent(e);
    }

    private formatTime(isoStr: string): string {
        const date = new Date(isoStr);
        const hour = String(date.getHours()).padStart(2, "0");
        const minute = String(date.getMinutes()).padStart(2, "0");
        return `${hour}:${minute}`;
    }

    private formatDateTime(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hour = String(date.getHours()).padStart(2, "0");
        const minute = String(date.getMinutes()).padStart(2, "0");
        return `${month}-${day} ${hour}:${minute}`;
    }
}
