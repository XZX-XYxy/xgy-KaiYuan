/*
 * Index.ets
 * 校园自习提醒卡片（校园原子提醒卡片 · 大赛项目）
 * 适配 OpenHarmony API 6.1.1，ArkTS 声明式开发范式
 *
 * 功能清单：
 * 1. List + ForEach 渲染提醒卡片（圆角、浅灰背景，含标题/时间/备注/删除按钮）
 * 2. 三个输入框 + 新增按钮：标题为空 Toast 提示，添加成功自动清空输入框
 * 3. 卡片右侧删除按钮，按索引删除对应提醒
 * 4. 数据保存在内存中：打开页面显示 3 条默认提醒，新增/删除本次运行生效
 */

// 轻量级系统弹窗模块（API 6.1 Toast 正确写法）
import prompt from '@system.prompt';

// ===== ReminderItem 实体类：提醒事项数据模型 =====
class ReminderItem {
  title: string;    // 提醒标题
  time: string;     // 提醒时间
  remark: string;   // 备注内容

  constructor(title: string, time: string, remark: string) {
    this.title = title;
    this.time = time;
    this.remark = remark;
  }
}

// Toast 轻提示工具函数，duration 单位毫秒
function showToast(msg: string) {
  prompt.showToast({ message: msg, duration: 2000 });
}

// 默认提醒数据（每次打开页面时展示）
function defaultReminders(): ReminderItem[] {
  return [
    new ReminderItem('图书馆自习', '今天 18:30', '三楼东区，记得带校园卡'),
    new ReminderItem('英语晨读打卡', '明天 07:20', '背诵 Unit 5 单词 50 个'),
    new ReminderItem('高数作业提交', '周五 20:00', '学习通平台在线提交')
  ];
}

@Entry
@Component
struct Index {
  // 提醒列表数据，@State 修饰，数据变化时列表自动刷新
  // 初始化为 3 条默认校园提醒，页面打开即可看到
  @State reminders: ReminderItem[] = defaultReminders();

  // 三个输入框的内容（同时用于 text 绑定，实现添加成功后自动清空）
  @State inputTitle: string = '';
  @State inputTime: string = '';
  @State inputRemark: string = '';

  /**
   * 新增提醒
   * 标题为空：Toast 提示“请输入提醒标题”，不新增
   * 校验通过：加入列表、自动清空三个输入框
   */
  addReminder() {
    // 1. 标题必填校验
    if (this.inputTitle.trim().length === 0) {
      showToast('请输入提醒标题');
      return;
    }
    // 2. 组装新卡片数据，时间/备注为空时给默认文案
    let item = new ReminderItem(
      this.inputTitle.trim(),
      this.inputTime.trim().length > 0 ? this.inputTime.trim() : '时间待定',
      this.inputRemark.trim().length > 0 ? this.inputRemark.trim() : '暂无备注'
    );
    // 3. 重新赋值数组，驱动列表刷新（早期版本推荐整体替换而非 push）
    this.reminders = this.reminders.concat(item);
    // 4. 自动清空三个输入框（输入框 text 绑定随 @State 置空而清空）
    this.inputTitle = '';
    this.inputTime = '';
    this.inputRemark = '';
  }

  /**
   * 删除提醒
   * @param index 要删除的条目下标（由 ForEach 的 index 传入）
   */
  deleteReminder(index: number) {
    // 复制一份列表，删除对应下标后整体重新赋值，触发界面刷新
    let list = this.reminders.slice(0);
    list.splice(index, 1);
    this.reminders = list;
  }

  build() {
    Column() {
      // ===== 1. 顶部标题 =====
      Text('校园自习提醒卡片')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor('#333333')
        .margin({ top: 18 })

      // 列表条数小提示
      Text('共 ' + this.reminders.length + ' 条提醒')
        .fontSize(13)
        .fontColor('#999999')
        .margin({ top: 4, bottom: 10 })

      // ===== 2. 提醒卡片列表 =====
      List({ space: 12 }) {   // space：卡片之间的间距
        ForEach(this.reminders, (item: ReminderItem, index: number) => {
          ListItem() {
            // 单条提醒卡片：左侧文字信息 + 右侧删除按钮
            Row() {
              // 左侧：标题 + 时间 + 备注
              Column() {
                Text(item.title)
                  .fontSize(17)
                  .fontWeight(FontWeight.Medium)
                  .fontColor('#333333')
                Text('时间：' + item.time)
                  .fontSize(14)
                  .fontColor('#43A047')   // 柔和校园绿，突出时间
                  .margin({ top: 6 })
                Text('备注：' + item.remark)
                  .fontSize(14)
                  .fontColor('#777777')
                  .margin({ top: 4 })
              }
              .layoutWeight(1)   // 占满左侧空间，把删除按钮挤到最右侧
              .alignItems(HorizontalAlign.Start)

              // 右侧：删除按钮，点击传入当前索引删除对应条目
              Button('删除')
                .width(64)
                .height(32)
                .fontSize(13)
                .fontColor('#FFFFFF')
                .backgroundColor('#E57373')   // 柔和珊瑚红
                .borderRadius(8)
                .onClick(() => {
                  this.deleteReminder(index);
                })
            }
            .width('100%')
            .padding(14)
            .backgroundColor('#F5F5F5')   // 浅灰卡片背景
            .borderRadius(12)             // 卡片圆角
          }
        })
      }
      .width('100%')     // 显式设置宽度，消除 List 宽度警告
      .layoutWeight(1)   // 显式分配剩余高度，消除 List 高度警告，超出可滚动

      // ===== 3. 输入区域 =====
      TextInput({ placeholder: '提醒标题（必填）', text: this.inputTitle })
        .height(44)
        .fontSize(15)
        .padding({ left: 12 })
        .backgroundColor('#FFFFFF')
        .borderRadius(8)
        .border({ width: 1, color: '#E0E0E0' })
        .margin({ top: 8 })
        .onChange((value: string) => {
          this.inputTitle = value;   // 记录标题输入
        })

      TextInput({ placeholder: '提醒时间（如：今天 18:30）', text: this.inputTime })
        .height(44)
        .fontSize(15)
        .padding({ left: 12 })
        .backgroundColor('#FFFFFF')
        .borderRadius(8)
        .border({ width: 1, color: '#E0E0E0' })
        .margin({ top: 10 })
        .onChange((value: string) => {
          this.inputTime = value;    // 记录时间输入
        })

      TextInput({ placeholder: '备注', text: this.inputRemark })
        .height(44)
        .fontSize(15)
        .padding({ left: 12 })
        .backgroundColor('#FFFFFF')
        .borderRadius(8)
        .border({ width: 1, color: '#E0E0E0' })
        .margin({ top: 10 })
        .onChange((value: string) => {
          this.inputRemark = value;  // 记录备注输入
        })

      // ===== 4. 新增按钮 =====
      Button('新增提醒')
        .width('100%')
        .height(46)
        .fontSize(16)
        .fontColor('#FFFFFF')
        .backgroundColor('#43A047')   // 校园绿主色按钮
        .borderRadius(10)
        .margin({ top: 14, bottom: 10 })
        .onClick(() => {
          this.addReminder();   // 点击调用新增函数
        })
    }
    .width('100%')
    .height('100%')
    .padding({ left: 16, right: 16 })
    .backgroundColor('#FFFFFF')
  }
}
