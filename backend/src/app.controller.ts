import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common'
import { SelectionService } from './selection.service'
import { Actor, AuthRole, AuthService, RegisterBody } from './auth.service'
import { Prefs, Scores } from './algo'

@Controller('api')
export class AppController {
  constructor(private readonly selection: SelectionService, private readonly auth: AuthService) {}

  private async mutate(header: string | undefined, roles: AuthRole[], action: (actor: Actor) => Promise<unknown>) {
    const actor = (await this.auth.actor(header, roles))!
    await action(actor)
    return this.selection.bootstrap(actor)
  }

  @Post('auth/register')
  register(@Body() b: RegisterBody) { return this.auth.register(b) }

  @Post('auth/login')
  login(@Body() b: { role: AuthRole; account: string; password: string }) { return this.auth.login(b) }

  @Get('auth/me')
  me(@Query('token') token: string) { return this.auth.me(token) }

  @Post('auth/logout')
  logout(@Body() b: { token: string }) { return this.auth.logout(b.token) }

  @Post('auth/change-password')
  changePassword(@Body() b: { token: string; oldPassword: string; newPassword: string }) { return this.auth.changePassword(b) }

  @Get('bootstrap')
  async bootstrap(@Headers('authorization') header?: string) {
    return this.selection.bootstrap(await this.auth.actor(header))
  }

  @Get('public-results')
  publicResults() { return this.selection.bootstrap(null, true) }

  @Post('intentions')
  intentions(@Headers('authorization') header: string, @Body() b: { mentorIds: string[]; prefs: Prefs }) {
    return this.mutate(header, ['student'], (a) => this.selection.fileIntentions(a.userId, b.mentorIds, b.prefs))
  }

  @Post('score')
  score(@Headers('authorization') header: string, @Body() b: { appId: string; scores: Scores }) {
    return this.mutate(header, ['mentor'], (a) => this.selection.score(a.userId, b.appId, b.scores))
  }

  @Post('interview-notices')
  sendInterviewNotices(@Headers('authorization') header: string, @Body() b: { appIds: string[]; interviewTime: string; location: string; note?: string }) {
    return this.mutate(header, ['mentor'], (a) => this.selection.sendInterviewNotices(a.userId, b.appIds, b.interviewTime, b.location, b.note))
  }

  @Post('mentor/bio')
  updateBio(@Headers('authorization') header: string, @Body() b: { bio: string }) {
    return this.mutate(header, ['mentor'], (a) => this.selection.updateBio(a.userId, b.bio))
  }

  @Post('mentor/profile')
  updateProfile(@Headers('authorization') header: string, @Body() b: { labId: string; direction: string }) {
    return this.mutate(header, ['mentor'], (a) => this.selection.updateProfile(a.userId, b.labId, b.direction))
  }

  @Post('admin/mentor-profile')
  adminUpdateMentorProfile(@Headers('authorization') header: string, @Body() b: { mentorId: string; labId: string; direction: string }) {
    return this.mutate(header, ['admin'], () => this.selection.adminUpdateMentorProfile(b.mentorId, b.labId, b.direction))
  }

  @Post('resume')
  saveResume(@Headers('authorization') header: string, @Body() b: { phone?: string; email?: string; intro: string; awards?: string; selfEval: string }) {
    return this.mutate(header, ['student'], (a) => this.selection.saveResume(a.userId, b))
  }

  @Post('evaluation')
  updateEvaluation(@Headers('authorization') header: string, @Body() b: { appId: string; evaluation: string }) {
    return this.mutate(header, ['mentor'], (a) => this.selection.updateEvaluation(a.userId, b.appId, b.evaluation))
  }

  @Post('generate')
  generate(@Headers('authorization') header: string) {
    return this.mutate(header, ['mentor'], (a) => this.selection.generate(a.userId))
  }

  @Post('confirm')
  confirm(@Headers('authorization') header: string, @Body() b: { appId: string }) {
    return this.mutate(header, ['student'], (a) => this.selection.confirm(a.userId, b.appId))
  }

  @Post('settle')
  settle(@Headers('authorization') header: string) {
    return this.mutate(header, ['admin'], () => this.selection.settle())
  }

  @Post('next-round')
  nextRound(@Headers('authorization') header: string) {
    return this.mutate(header, ['admin'], () => this.selection.nextRound())
  }

  @Post('adjust')
  adjust(@Headers('authorization') header: string) {
    return this.mutate(header, ['admin'], () => this.selection.openAdjustment())
  }

  @Post('allocate')
  allocate(@Headers('authorization') header: string) {
    return this.mutate(header, ['admin'], () => this.selection.runAdjustment())
  }

  @Post('publish')
  publish(@Headers('authorization') header: string) {
    return this.mutate(header, ['admin'], () => this.selection.publish())
  }

  @Post('notices/read')
  readNotice(@Headers('authorization') header: string, @Body() b: { id: string }) {
    return this.mutate(header, ['student'], (a) => this.selection.readNotice(a.userId, b.id))
  }

  @Post('notices/read-all')
  readAllNotices(@Headers('authorization') header: string) {
    return this.mutate(header, ['student'], (a) => this.selection.readAllNotices(a.userId))
  }

  @Post('objections')
  fileObjection(@Headers('authorization') header: string, @Body() b: { reason: string }) {
    return this.mutate(header, ['student'], (a) => this.selection.fileObjection(a.userId, b.reason))
  }

  @Post('objections/resolve')
  resolveObjection(@Headers('authorization') header: string, @Body() b: { id: string; status: string; reply: string }) {
    return this.mutate(header, ['admin'], () => this.selection.resolveObjection(b.id, b.status, b.reply))
  }
}
