# typescript-router

A small and very typesafe router for `TypeScript`. Can be used with any client library/framework.

Route matching only occurs on the path portion of the url but query strings are all passed along (though multivalued query params aren't supported)

## API

### Create a new router

```ts
  import {string, number, isoDate} from 'idonttrustlikethat'

  type UserId = string & { _tag: 'UserId' }
  const userId = string.tagged<UserId>()

  const router = Router(
    {
      index: Route('/'),
      users: Route('/users', object({ date: isoDate })),
      user: Route('/users/:id', object({ id: userId, q: number.optional() }))
    },
    { onNotFound }
  )

  function onNotFound(reason: string) {
    console.error(reason)
  }
```

### Finding out the current Route

The route is synchronously available on the router, after its creation.  

```ts
if (router.route.name === 'users') {
  doSomethingWithIt(router.route.params.date)
}
```

### Subscribing to route changes

```ts
const unsubscribe = router.onChange(() => {
  console.log(router.route)
})
```

### Update the route

```ts
router.push('users', {date: '2020-12-22T17:31:58.337Z'})
// router.route is now {name: 'users', params: {date: Date}}

// Or
router.replace('users', {date: '2020-12-22T17:31:58.337Z'}))
```

### Compute a link string ready to be used in anchors

```ts
const link = router.link('users', {date: '2020-12-22T17:31:58.337Z'})
// '/users?date=2020-12-22T17%3A31%3A58.337Z'
```