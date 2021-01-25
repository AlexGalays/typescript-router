import expect from 'expect'
import { Router, Route, RouteAndParams, RouteParams } from '../'
import { object, number, string, isoDate } from 'idonttrustlikethat'

describe('Router', () => {
  it('works with a basic scenario', () => {
    const date = '2020-12-22T17:31:58.337Z'
    mockGlobals({ startLocation: { pathname: '/users', search: `?date=${date}` } })

    let notFoundCounter = 0
    let changeCounter = 0

    const router = Router(
      {
        index: Route('/'),
        users: Route('/users', object({ date: isoDate })),
        user: Route('/users/:id', object({ id: userId, q: number.optional() }))
      },
      { onNotFound }
    )

    type AppRouter = typeof router

    const unsub = router.onChange(() => {
      changeCounter++
    })

    function onNotFound(reason: string) {
      console.error(reason)
      notFoundCounter++
    }

    expect(notFoundCounter).toBe(0)
    expect(changeCounter).toBe(0)

    expect(router.route.name === 'users' && router.route.params.date.getTime()).toBe(
      new Date(date).getTime()
    )

    router.push('user', { id: UserId('123') })

    expect(changeCounter).toBe(1)

    expect(router.route.name === 'user' && router.route.params.id).toBe('123')

    router.replace('index', {})

    expect(changeCounter).toBe(2)

    expect(router.route.name === 'index' && Object.keys(router.route.params).length).toBe(0)

    const usersLink = router.link('users', { date })
    expect(usersLink).toBe(`/users?date=${encodeURIComponent(date)}`)

    const userLink = router.link('user', { id: UserId('123'), q: 11 })
    expect(userLink).toBe('/users/123?q=11')

    router.push('users', { date: 'not_a_date' })
    expect(notFoundCounter).toBe(1)
    expect(router.route.name === 'notFound')

    const onChangeBeforeUnsubbing = changeCounter
    unsub()
    router.push('user', { id: UserId('123') })
    expect(changeCounter).toBe(onChangeBeforeUnsubbing)

    type AppRouteParamTuples = RouteAndParams<AppRouter>
    type UsersRouteParams = RouteParams<AppRouter, 'users'>
    type UserRouteParams = RouteParams<AppRouter, 'user'>

    const _typeAssertion1: AreEquals<{ date: Date }, UsersRouteParams> = true
    const _typeAssertion2: AreEquals<{ id: UserId; q?: number }, UserRouteParams> = true

    type SerializableType =
      | ['index', {}]
      | ['users', { date: string }]
      | ['user', { id: UserId; q?: number | undefined }]

    const _typeAssertion3: AreEquals<SerializableType, AppRouteParamTuples> = true
  })

  it('can redirect on route not found during init', () => {
    mockGlobals({ startLocation: { pathname: '/ohno', search: '' } })

    const router = Router(
      {
        index: Route('/'),
        users: Route('/users', object({ date: isoDate }))
      },
      {
        onNotFound: (_reason, r) => {
          r.replace('index', {})
        }
      }
    )

    expect(router.route.name).toBe('index')
  })

  it('decodes the url params', () => {
    mockGlobals({
      startLocation: {
        pathname: '/users/LIG%3AIDFM%3AC01130',
        search: '?extra=LIG%3AIDFM%3AC01130'
      }
    })

    const router = Router(
      {
        index: Route('/'),
        users: Route('/users/:userId', object({ userId: string, extra: string }))
      },
      {
        onNotFound: reason => {
          console.error(reason)
        }
      }
    )

    expect(router.route.name).toBe('users')

    expect(router.route.params).toEqual({
      userId: 'LIG:IDFM:C01130',
      extra: 'LIG:IDFM:C01130'
    })
  })
})

export type UserId = string & { _tag: 'UserId' }

export const userId = string.tagged<UserId>()

function UserId(fromString: string) {
  return fromString as UserId
}

function mockGlobals({ startLocation }: { startLocation: { pathname: string; search: string } }) {
  const window = global as any

  window.addEventListener = () => {}

  window.location = {
    ...startLocation
  }

  function changeHistoryState(uri: string) {
    const [pathname, search] = uri.split('?')
    window.location.pathname = pathname || ''
    window.location.search = search || ''
  }

  window.history = {
    pushState: changeHistoryState,
    replaceState: changeHistoryState
  }
}

type AreEquals<T, U, Y = true, N = false> = (<G>() => G extends T ? 1 : 2) extends <
  G
>() => G extends U ? 1 : 2
  ? Y
  : N
