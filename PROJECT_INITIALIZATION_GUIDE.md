### 计费体系说明

项目采用 MuleRun 平台的 **Creator Metering 计费模式**，完全采用 **Custom Metering（自定义计费）** 方式，由 Creator 自主定义计费逻辑。

**Custom Metering（自定义计费）的特点：**

- 💸 **完全控制计费计算逻辑**：Creator 可根据自身需求自主定义计费模式（不限于按分钟或按步数）
- 🚀 **基于 Metering API 上报**：通过 Metering Report API 报告实际使用成本
- 🔒 **支持幂等性**：通过唯一的 meteringId 防止重复计费
- 📄 **成本单位**：0.0001 credits 的增量

**Metering API 相关端点：**

- **Metering Report API**
  - 端点：`POST https://api.mulerun.com/sessions/metering`
  - 用途：报告会话的使用成本
  - 特性：支持幂等性（通过 meteringId 防止重复计费）、支持标记最终报告以终止会话

- **Metering Get Reports API**
  - 端点：`GET https://api.mulerun.com/sessions/metering/{sessionId}`
  - 用途：查询会话的使用成本和状态
  - 返回信息：会话状态、报告计数、是否收到最终报告等

**项目中的计费实现：**

项目中不应硬编码成本值，而应当根据实际的业务逻辑动态计算：

1. **根据业务逻辑计算成本**：根据实际 API 调用、计算时间、资源消耗等策计算成本
2. **通过 Metering API 上报**：调用 Metering Report API 上报实际成本
3. **使用幂等机制**：每个计费报告使用唯一的 meteringId，防止重复计费

**关键点：**
- ✅ 计费完全由 Creator 自主定义
- ✅ 没有预定义的「按分钟」或「按步数」说法
- ✅ 成本单位以 0.0001 credits 为最小增量
- ✅ 使用 Metering API 的幂等机制确保准确计费
- ✅ 支持完全灵活的自定义计费逻辑
- ✅ 详细文档见 [MuleRun Metering API](https://mulerun.com/docs/creator-guide/agent/iframe-agent-spec)

**参考文档**：详见 MuleRun 官方文档中的"Creator Metering"和"Metering APIs"部分
