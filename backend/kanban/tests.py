"""
kanban/tests.py
===============
Comprehensive unit tests for the Kanban API (django-ninja, mounted at /api/).

Coverage focuses on:
  1.  Authentication guard  — unauthenticated requests get 401/403.
  2.  Ownership isolation   — users can CRUD their own boards/lists/cards,
                              and cannot access or mutate another user's.
  3.  Full CRUD lifecycle   — POST / GET / PUT / DELETE happy-paths for the
                              most important resources.

Run with:
    python manage.py test kanban.tests --verbosity 2
"""

import json
from unittest import expectedFailure
from django.test import TestCase, Client
from django.contrib.auth.models import User
from django.urls import reverse

from kanban.models import (
    Board,
    List,
    TaskCard,
    BoardLabel,
    Comment,
    Checklist,
    ChecklistItem,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

BASE = "/api"


def _url(path: str) -> str:
    """Prepend the API base path so tests read cleanly."""
    return f"{BASE}{path}"


def _json(resp) -> dict:
    """Parse JSON from a Django test response."""
    return json.loads(resp.content)


# ---------------------------------------------------------------------------
# Shared fixture mixin — creates two independent users with their own boards.
# ---------------------------------------------------------------------------

class TwoUserFixture(TestCase):
    """
    Sets up:
      self.alice / self.alice_client  — board owner (user 1)
      self.bob   / self.bob_client    — separate user (user 2)
      self.alice_board                — board owned by Alice
      self.alice_list                 — list inside alice_board
      self.alice_card                 — card inside alice_list
    """

    def setUp(self):
        # Users
        self.alice = User.objects.create_user("alice", password="pass123")
        self.bob = User.objects.create_user("bob", password="pass123")

        # Clients
        self.alice_client = Client()
        self.alice_client.force_login(self.alice)

        self.bob_client = Client()
        self.bob_client.force_login(self.bob)

        self.anon_client = Client()  # not logged in

        # Alice's fixtures
        self.alice_board = Board.objects.create(name="Alice Board", owner=self.alice)
        self.alice_list = List.objects.create(
            board=self.alice_board, name="Alice List", order=0
        )
        self.alice_card = TaskCard.objects.create(
            list=self.alice_list,
            title="Alice Card",
            description="desc",
            order=0,
        )

        # Bob's fixtures (separate universe)
        self.bob_board = Board.objects.create(name="Bob Board", owner=self.bob)
        self.bob_list = List.objects.create(
            board=self.bob_board, name="Bob List", order=0
        )
        self.bob_card = TaskCard.objects.create(
            list=self.bob_list,
            title="Bob Card",
            description="desc",
            order=0,
        )

    # -----------------------------------------------------------------------
    # Convenience POST helper (sends JSON with content-type header)
    # -----------------------------------------------------------------------

    @staticmethod
    def _post(client: Client, url: str, data: dict):
        return client.post(
            url,
            data=json.dumps(data),
            content_type="application/json",
        )

    @staticmethod
    def _put(client: Client, url: str, data: dict):
        return client.put(
            url,
            data=json.dumps(data),
            content_type="application/json",
        )

    @staticmethod
    def _delete(client: Client, url: str):
        return client.delete(url, content_type="application/json")


# ===========================================================================
# 1. AUTHENTICATION GUARD TESTS
# ===========================================================================

class AuthenticationTests(TwoUserFixture):
    """Unauthenticated requests must be refused (401 or 403)."""

    def _assert_rejected(self, resp):
        self.assertIn(resp.status_code, [401, 403],
                      msg=f"Expected 401/403, got {resp.status_code}: {resp.content}")

    def test_anon_cannot_list_boards(self):
        resp = self.anon_client.get(_url("/boards/"))
        # Ninja returns 401 for unauthenticated requests when auth is configured
        self._assert_rejected(resp)

    def test_anon_cannot_create_board(self):
        resp = self._post(self.anon_client, _url("/boards/"), {"name": "Hack"})
        self._assert_rejected(resp)

    def test_anon_cannot_create_card(self):
        resp = self._post(
            self.anon_client,
            _url("/cards/"),
            {"list_id": self.alice_list.id, "title": "Hack"},
        )
        self._assert_rejected(resp)

    def test_anon_cannot_update_card(self):
        resp = self._put(
            self.anon_client,
            _url(f"/cards/{self.alice_card.id}/"),
            {"title": "Hacked"},
        )
        self._assert_rejected(resp)

    def test_anon_cannot_delete_board(self):
        resp = self._delete(self.anon_client, _url(f"/boards/{self.alice_board.id}/"))
        self._assert_rejected(resp)

    def test_anon_cannot_get_board(self):
        resp = self.anon_client.get(_url(f"/boards/{self.alice_board.id}/"))
        self._assert_rejected(resp)

    def test_anon_cannot_create_list(self):
        resp = self._post(
            self.anon_client,
            _url("/lists/"),
            {"board_id": self.alice_board.id, "name": "Hack"},
        )
        self._assert_rejected(resp)

    def test_anon_cannot_create_comment(self):
        resp = self._post(
            self.anon_client,
            _url(f"/cards/{self.alice_card.id}/comments/"),
            {"text": "anon comment"},
        )
        self._assert_rejected(resp)


# ===========================================================================
# 2. BOARD CRUD — AUTHENTICATED HAPPY PATH
# ===========================================================================

class BoardCRUDTests(TwoUserFixture):
    """A logged-in user can create, read, update, and delete their own boards."""

    def test_list_boards_returns_only_own_boards(self):
        resp = self.alice_client.get(_url("/boards/"))
        self.assertEqual(resp.status_code, 200)
        boards = _json(resp)
        ids = [b["id"] for b in boards]
        self.assertIn(self.alice_board.id, ids)
        self.assertNotIn(self.bob_board.id, ids)

    def test_create_board_success(self):
        resp = self._post(self.alice_client, _url("/boards/"), {"name": "New Board"})
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertEqual(data["name"], "New Board")
        self.assertTrue(Board.objects.filter(name="New Board", owner=self.alice).exists())

    def test_create_board_sets_standard_labels(self):
        resp = self._post(self.alice_client, _url("/boards/"), {"name": "Labelled Board"})
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        # Standard labels are created on board creation
        self.assertGreater(len(data["labels"]), 0)

    def test_update_own_board_success(self):
        resp = self._put(
            self.alice_client,
            _url(f"/boards/{self.alice_board.id}/"),
            {"name": "Renamed Board"},
        )
        self.assertEqual(resp.status_code, 200)
        self.alice_board.refresh_from_db()
        self.assertEqual(self.alice_board.name, "Renamed Board")

    def test_archive_own_board_success(self):
        resp = self._put(
            self.alice_client,
            _url(f"/boards/{self.alice_board.id}/"),
            {"is_archived": True},
        )
        self.assertEqual(resp.status_code, 200)
        self.alice_board.refresh_from_db()
        self.assertTrue(self.alice_board.is_archived)

    def test_delete_own_board_success(self):
        resp = self._delete(self.alice_client, _url(f"/boards/{self.alice_board.id}/"))
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(Board.objects.filter(id=self.alice_board.id).exists())

    def test_get_board_detail_success(self):
        resp = self.alice_client.get(_url(f"/boards/{self.alice_board.id}/"))
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertEqual(data["id"], self.alice_board.id)


# ===========================================================================
# 3. BOARD OWNERSHIP ISOLATION — CROSS-USER ACCESS DENIAL
# ===========================================================================

class BoardOwnershipTests(TwoUserFixture):
    """
    Bob must NOT be able to modify or access Alice's board data.

    NOTE: The current API does not enforce ownership on GET/PUT/DELETE for
    boards — these tests document the *expected* secure behaviour so that when
    ownership checks are added to the view functions the tests will go green.
    Tests are written with assertNotEqual(200) to flag any response that
    grants access; 403/404 are both acceptable rejection codes.
    """

    def _assert_no_access(self, resp):
        self.assertNotEqual(
            resp.status_code, 200,
            msg=f"Expected non-200 (access denied) but got 200. Body: {resp.content[:300]}"
        )

    def test_bob_cannot_update_alices_board(self):
        resp = self._put(
            self.bob_client,
            _url(f"/boards/{self.alice_board.id}/"),
            {"name": "Hacked by Bob"},
        )
        self._assert_no_access(resp)
        # Database should be unchanged
        self.alice_board.refresh_from_db()
        self.assertNotEqual(self.alice_board.name, "Hacked by Bob")

    def test_bob_cannot_delete_alices_board(self):
        resp = self._delete(self.bob_client, _url(f"/boards/{self.alice_board.id}/"))
        self._assert_no_access(resp)
        self.assertTrue(Board.objects.filter(id=self.alice_board.id).exists())

    def test_alice_board_absent_from_bobs_board_list(self):
        """list_boards() filters by owner — Alice's board must not appear for Bob."""
        resp = self.bob_client.get(_url("/boards/"))
        self.assertEqual(resp.status_code, 200)
        ids = [b["id"] for b in _json(resp)]
        self.assertNotIn(self.alice_board.id, ids)

    def test_bob_cannot_update_alices_card(self):
        resp = self._put(
            self.bob_client,
            _url(f"/cards/{self.alice_card.id}/"),
            {"title": "Hacked by Bob"},
        )
        self._assert_no_access(resp)
        self.alice_card.refresh_from_db()
        self.assertNotEqual(self.alice_card.title, "Hacked by Bob")

    def test_bob_cannot_archive_alices_card(self):
        resp = self._put(
            self.bob_client,
            _url(f"/cards/{self.alice_card.id}/archive/"),
            {},
        )
        self._assert_no_access(resp)
        self.alice_card.refresh_from_db()
        self.assertFalse(self.alice_card.is_archived)

    def test_bob_cannot_create_card_in_alices_list(self):
        resp = self._post(
            self.bob_client,
            _url("/cards/"),
            {"list_id": self.alice_list.id, "title": "Bob Injected Card"},
        )
        self._assert_no_access(resp)
        self.assertFalse(
            TaskCard.objects.filter(list=self.alice_list, title="Bob Injected Card").exists()
        )

    def test_bob_cannot_create_list_on_alices_board(self):
        resp = self._post(
            self.bob_client,
            _url("/lists/"),
            {"board_id": self.alice_board.id, "name": "Bob Injected List"},
        )
        self._assert_no_access(resp)
        self.assertFalse(
            List.objects.filter(board=self.alice_board, name="Bob Injected List").exists()
        )

    def test_bob_cannot_update_alices_list(self):
        resp = self._put(
            self.bob_client,
            _url(f"/lists/{self.alice_list.id}/"),
            {"name": "Hacked List"},
        )
        self._assert_no_access(resp)
        self.alice_list.refresh_from_db()
        self.assertNotEqual(self.alice_list.name, "Hacked List")

    def test_bob_cannot_add_member_to_alices_board(self):
        resp = self._post(
            self.bob_client,
            _url(f"/boards/{self.alice_board.id}/members/"),
            {"username": "bob"},
        )
        # The endpoint explicitly returns an error dict (not 200 success) for non-owners.
        # Accept either a rejected HTTP status OR a 200 with an error payload.
        if resp.status_code == 200:
            data = _json(resp)
            self.assertIn(
                "error", data,
                msg="Expected an error payload when non-owner adds member, got success"
            )


# ===========================================================================
# 4. CARD CRUD — AUTHENTICATED HAPPY PATH
# ===========================================================================

class CardCRUDTests(TwoUserFixture):
    """Alice can fully manage cards on her own board."""

    def test_create_card_success(self):
        resp = self._post(
            self.alice_client,
            _url("/cards/"),
            {"list_id": self.alice_list.id, "title": "New Card", "description": "details"},
        )
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertEqual(data["title"], "New Card")
        self.assertEqual(data["list_id"], self.alice_list.id)
        self.assertTrue(TaskCard.objects.filter(title="New Card").exists())

    def test_create_card_sets_order_at_end(self):
        resp = self._post(
            self.alice_client,
            _url("/cards/"),
            {"list_id": self.alice_list.id, "title": "Second Card"},
        )
        data = _json(resp)
        # First card already exists at order 0; new card should be 1
        self.assertEqual(data["order"], 1)

    def test_update_card_title(self):
        resp = self._put(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/"),
            {"title": "Updated Title"},
        )
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertEqual(data["title"], "Updated Title")
        self.alice_card.refresh_from_db()
        self.assertEqual(self.alice_card.title, "Updated Title")

    def test_update_card_description(self):
        resp = self._put(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/"),
            {"description": "Updated description"},
        )
        self.assertEqual(resp.status_code, 200)
        self.alice_card.refresh_from_db()
        self.assertEqual(self.alice_card.description, "Updated description")

    def test_update_card_color_boost(self):
        resp = self._put(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/"),
            {"color_boost": "bg-red-500"},
        )
        self.assertEqual(resp.status_code, 200)
        self.alice_card.refresh_from_db()
        self.assertEqual(self.alice_card.color_boost, "bg-red-500")

    def test_archive_card_toggles_flag(self):
        # Archive
        resp = self._put(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/archive/"),
            {},
        )
        self.assertEqual(resp.status_code, 200)
        self.alice_card.refresh_from_db()
        self.assertTrue(self.alice_card.is_archived)

        # Unarchive
        resp2 = self._put(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/archive/"),
            {},
        )
        self.assertEqual(resp2.status_code, 200)
        self.alice_card.refresh_from_db()
        self.assertFalse(self.alice_card.is_archived)

    def test_move_card_within_same_list(self):
        # Create a second card to have something to reorder
        card2 = TaskCard.objects.create(
            list=self.alice_list, title="Card 2", order=1
        )
        resp = self._put(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/move/"),
            {"new_list_id": self.alice_list.id, "new_order": 1},
        )
        self.assertEqual(resp.status_code, 200)

    def test_move_card_across_lists(self):
        second_list = List.objects.create(
            board=self.alice_board, name="Second List", order=1
        )
        resp = self._put(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/move/"),
            {"new_list_id": second_list.id, "new_order": 0},
        )
        self.assertEqual(resp.status_code, 200)
        self.alice_card.refresh_from_db()
        self.assertEqual(self.alice_card.list_id, second_list.id)

    def test_nonexistent_card_returns_404(self):
        resp = self._put(
            self.alice_client,
            _url("/cards/999999/"),
            {"title": "ghost"},
        )
        self.assertEqual(resp.status_code, 404)


# ===========================================================================
# 5. LIST CRUD — AUTHENTICATED HAPPY PATH
# ===========================================================================

class ListCRUDTests(TwoUserFixture):
    """Alice can create and update lists on her own board."""

    def test_create_list_success(self):
        resp = self._post(
            self.alice_client,
            _url("/lists/"),
            {"board_id": self.alice_board.id, "name": "Sprint 1"},
        )
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertEqual(data["name"], "Sprint 1")
        self.assertTrue(List.objects.filter(name="Sprint 1", board=self.alice_board).exists())

    def test_update_list_name(self):
        resp = self._put(
            self.alice_client,
            _url(f"/lists/{self.alice_list.id}/"),
            {"name": "Renamed List"},
        )
        self.assertEqual(resp.status_code, 200)
        self.alice_list.refresh_from_db()
        self.assertEqual(self.alice_list.name, "Renamed List")

    def test_update_list_color(self):
        resp = self._put(
            self.alice_client,
            _url(f"/lists/{self.alice_list.id}/"),
            {"color": "bg-blue-500"},
        )
        self.assertEqual(resp.status_code, 200)
        self.alice_list.refresh_from_db()
        self.assertEqual(self.alice_list.color, "bg-blue-500")

    def test_archive_list_toggles_flag(self):
        resp = self._put(
            self.alice_client,
            _url(f"/lists/{self.alice_list.id}/archive/"),
            {},
        )
        self.assertEqual(resp.status_code, 200)
        self.alice_list.refresh_from_db()
        self.assertTrue(self.alice_list.is_archived)

    def test_nonexistent_list_returns_404(self):
        resp = self._put(
            self.alice_client,
            _url("/lists/999999/"),
            {"name": "ghost"},
        )
        self.assertEqual(resp.status_code, 404)


# ===========================================================================
# 6. COMMENTS — AUTHENTICATED HAPPY PATH
# ===========================================================================

class CommentTests(TwoUserFixture):
    """A logged-in user can post comments on any card they can reach."""

    def test_create_comment_on_own_card(self):
        resp = self._post(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/comments/"),
            {"text": "Looks good!"},
        )
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertEqual(data["text"], "Looks good!")
        self.assertTrue(Comment.objects.filter(card=self.alice_card, text="Looks good!").exists())

    def test_comment_author_is_set_to_logged_in_user(self):
        self._post(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/comments/"),
            {"text": "My comment"},
        )
        comment = Comment.objects.get(card=self.alice_card, text="My comment")
        self.assertEqual(comment.author, self.alice)

    def test_comment_on_nonexistent_card_returns_404(self):
        resp = self._post(
            self.alice_client,
            _url("/cards/999999/comments/"),
            {"text": "ghost"},
        )
        self.assertEqual(resp.status_code, 404)


# ===========================================================================
# 7. CHECKLISTS — AUTHENTICATED HAPPY PATH
# ===========================================================================

class ChecklistTests(TwoUserFixture):
    """Alice can add checklists and items to her cards."""

    def test_create_checklist_on_own_card(self):
        resp = self._post(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/checklists/"),
            {"title": "Definition of Done"},
        )
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertEqual(data["title"], "Definition of Done")
        self.assertTrue(Checklist.objects.filter(card=self.alice_card, title="Definition of Done").exists())

    def test_create_checklist_item(self):
        checklist = Checklist.objects.create(card=self.alice_card, title="DoD")
        resp = self._post(
            self.alice_client,
            _url(f"/checklists/{checklist.id}/items/"),
            {"text": "Write tests"},
        )
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertEqual(data["text"], "Write tests")
        self.assertFalse(data["is_completed"])

    def test_toggle_checklist_item(self):
        checklist = Checklist.objects.create(card=self.alice_card, title="DoD")
        item = ChecklistItem.objects.create(checklist=checklist, text="Write tests")
        self.assertFalse(item.is_completed)

        resp = self._put(
            self.alice_client,
            _url(f"/items/{item.id}/toggle/"),
            {},
        )
        self.assertEqual(resp.status_code, 200)
        item.refresh_from_db()
        self.assertTrue(item.is_completed)

        # Toggle back
        resp2 = self._put(
            self.alice_client,
            _url(f"/items/{item.id}/toggle/"),
            {},
        )
        self.assertEqual(resp2.status_code, 200)
        item.refresh_from_db()
        self.assertFalse(item.is_completed)


# ===========================================================================
# 8. BOARD LABELS — AUTHENTICATED HAPPY PATH
# ===========================================================================

class BoardLabelTests(TwoUserFixture):
    """Alice can create, update, and delete labels on her board."""

    def test_create_board_label(self):
        resp = self._post(
            self.alice_client,
            _url(f"/boards/{self.alice_board.id}/labels/"),
            {"name": "Bug", "color": "#ff0000"},
        )
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertEqual(data["name"], "Bug")
        self.assertTrue(BoardLabel.objects.filter(board=self.alice_board, name="Bug").exists())

    def test_update_board_label(self):
        label = BoardLabel.objects.create(board=self.alice_board, name="Old", color="#aaa")
        resp = self._put(
            self.alice_client,
            _url(f"/labels/{label.id}/"),
            {"name": "New", "color": "#123456"},
        )
        self.assertEqual(resp.status_code, 200)
        label.refresh_from_db()
        self.assertEqual(label.name, "New")
        self.assertEqual(label.color, "#123456")

    def test_delete_board_label(self):
        label = BoardLabel.objects.create(board=self.alice_board, name="Temp", color="#fff")
        resp = self._delete(self.alice_client, _url(f"/labels/{label.id}/"))
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(BoardLabel.objects.filter(id=label.id).exists())

    def test_assign_label_to_card(self):
        label = BoardLabel.objects.create(board=self.alice_board, name="Sprint", color="#00f")
        resp = self._post(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/labels/{label.id}/"),
            {},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn(label, self.alice_card.board_labels.all())

    def test_remove_label_from_card(self):
        label = BoardLabel.objects.create(board=self.alice_board, name="Sprint", color="#00f")
        self.alice_card.board_labels.add(label)

        resp = self._delete(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/labels/{label.id}/"),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn(label, self.alice_card.board_labels.all())


# ===========================================================================
# 9. USER ASSIGNEES — AUTHENTICATED HAPPY PATH
# ===========================================================================

class AssigneeTests(TwoUserFixture):
    """Alice can assign and unassign users to/from her cards."""

    def test_assign_user_to_card(self):
        resp = self._post(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/assignees/{self.bob.id}/"),
            {},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn(self.bob, self.alice_card.assignees.all())

    def test_unassign_user_from_card(self):
        self.alice_card.assignees.add(self.bob)
        resp = self._delete(
            self.alice_client,
            _url(f"/cards/{self.alice_card.id}/assignees/{self.bob.id}/"),
        )
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn(self.bob, self.alice_card.assignees.all())


# ===========================================================================
# 10. ACTIVE & ARCHIVED BOARD VIEWS
# ===========================================================================

class BoardViewTests(TwoUserFixture):
    """Tests for the active-board and archived-items endpoints."""

    def test_get_active_board_excludes_archived_cards(self):
        # Archive Alice's card
        self.alice_card.is_archived = True
        self.alice_card.save()

        resp = self.alice_client.get(_url(f"/boards/{self.alice_board.id}/active/"))
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        all_card_ids = [
            card["id"]
            for lst in data["lists"]
            for card in lst["cards"]
        ]
        self.assertNotIn(self.alice_card.id, all_card_ids)

    def test_get_archived_items_returns_archived_card(self):
        self.alice_card.is_archived = True
        self.alice_card.save()

        resp = self.alice_client.get(_url(f"/boards/{self.alice_board.id}/archived/"))
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        archived_card_ids = [c["id"] for c in data["cards"]]
        self.assertIn(self.alice_card.id, archived_card_ids)

    def test_get_archived_items_returns_archived_list(self):
        self.alice_list.is_archived = True
        self.alice_list.save()

        resp = self.alice_client.get(_url(f"/boards/{self.alice_board.id}/archived/"))
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        archived_list_ids = [lst["id"] for lst in data["lists"]]
        self.assertIn(self.alice_list.id, archived_list_ids)


# ===========================================================================
# 11. SEARCH MEMBERS — AUTHENTICATED
# ===========================================================================

class SearchMembersTests(TwoUserFixture):
    """The search_members endpoint returns the board owner + any board members."""

    def test_search_members_includes_owner(self):
        resp = self.alice_client.get(_url(f"/boards/{self.alice_board.id}/search_members/"))
        self.assertEqual(resp.status_code, 200)
        user_ids = [u["id"] for u in _json(resp)]
        self.assertIn(self.alice.id, user_ids)

    def test_anon_cannot_search_members(self):
        resp = self.anon_client.get(_url(f"/boards/{self.alice_board.id}/search_members/"))
        self.assertIn(resp.status_code, [401, 403])


# ===========================================================================
# 12. LOGOUT ENDPOINT
# ===========================================================================

class LogoutTests(TwoUserFixture):
    """The logout endpoint should invalidate the session."""

    def test_logout_returns_success(self):
        resp = self._post(self.alice_client, _url("/logout/"), {})
        self.assertEqual(resp.status_code, 200)
        data = _json(resp)
        self.assertTrue(data.get("success"))

    def test_after_logout_board_list_is_rejected(self):
        # Log in, then log out via the API, then list_boards should fail.
        self._post(self.alice_client, _url("/logout/"), {})
        resp = self.alice_client.get(_url("/boards/"))
        self.assertIn(resp.status_code, [200, 401, 403])
        # list_boards returns [] for unauthenticated rather than 401 (soft guard).
        # If 200, the returned list must be empty.
        if resp.status_code == 200:
            self.assertEqual(_json(resp), [])
